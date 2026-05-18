/**
 * Red-team E2E tests
 *
 * These tests generate real projects with adversarial / edge-case recipe and
 * option combinations, install dependencies, and then inspect the generated
 * output for:
 *   - TypeScript compilation errors  (tsc --noEmit)
 *   - Missing or duplicate dependencies
 *   - Env var collisions between recipes
 *   - Structural problems (missing files, broken imports)
 *   - Content correctness (wrong project name, stale placeholders)
 *
 * Strategy: beforeAll generates + installs all variants in parallel,
 * individual tests are fast assertions on the already-installed projects.
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { spawn } from 'node:child_process';
import fsExtra from 'fs-extra';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, FrontendFramework, RecipeId } from '@spoonfeed/types';

jest.setTimeout(15 * 60 * 1000);

jest.mock('@clack/prompts', () => ({
  spinner: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn(), error: jest.fn(), info: jest.fn(), success: jest.fn() },
  intro: jest.fn(),
  outro: jest.fn(),
  text: jest.fn(),
  select: jest.fn(),
  multiselect: jest.fn(),
  confirm: jest.fn(),
  isCancel: jest.fn().mockReturnValue(false),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function spawnAsync(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 5 * 60 * 1000,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'pipe' });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on('data', (d: Buffer) => out.push(d));
    proc.stderr.on('data', (d: Buffer) => err.push(d));
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout: ${cmd} ${args.join(' ')}`));
    }, timeoutMs);
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(out).toString(),
        stderr: Buffer.concat(err).toString(),
      });
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

function makeConfig(overrides: Partial<ProjectConfig> & { outputDir: string }): ProjectConfig {
  return {
    name: 'redteam',
    projectType: 'http-api',
    cloudProvider: 'aws',
    httpAdapter: 'fastify',
    recipes: [],
    deploymentTargets: [],
    frontendFramework: undefined,
    transportLayer: undefined,
    scope: undefined,
    outputDir: overrides.outputDir,
    ...overrides,
  };
}

function readJson(p: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
}

function readText(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

function exists(p: string): boolean {
  return fs.existsSync(p);
}

async function pnpmInstall(cwd: string): Promise<void> {
  const r = await spawnAsync('pnpm', ['install', '--no-frozen-lockfile'], cwd, 5 * 60 * 1000);
  if (r.exitCode !== 0) throw new Error(`pnpm install failed:\n${r.stderr || r.stdout}`);
}

async function tsc(cwd: string, project?: string): Promise<SpawnResult> {
  const args = ['exec', 'tsc', '--noEmit'];
  if (project) args.push('-p', project);
  return spawnAsync('pnpm', args, cwd, 2 * 60 * 1000);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let registry: RecipeRegistry;
beforeAll(() => {
  registry = new RecipeRegistry();
  registerAllRecipes(registry);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RECIPE ENV VAR COLLISIONS
//    Two recipes that both define REDIS_HOST / REDIS_PORT (bullmq + redis-cache)
// ═══════════════════════════════════════════════════════════════════════════════

describe('1. Env var collisions: redis-cache + bullmq', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-env-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({ name: 'env-clash', recipes: ['redis-cache', 'bullmq'], outputDir: dir }),
      registry,
      TEMPLATES_DIR,
    );
  });
  afterAll(() => fsExtra.remove(tmpDir));

  it('should not have duplicate env var keys in .env.example', () => {
    const env = readText(path.join(dir, '.env.example'));
    const keys = env
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split('=')[0]);
    const unique = new Set(keys);
    // If there are duplicates, some key appears more than once
    const dupes = keys.filter((k) => keys.indexOf(k) !== keys.lastIndexOf(k));
    expect(dupes).toEqual([]);
  });

  it('should have section markers for redis-cache (bullmq vars deduped into it)', () => {
    const env = readText(path.join(dir, '.env.example'));
    expect(env).toContain('# --- Redis Cache ---');
    expect(env).toContain('# --- end Redis Cache ---');
    // BullMQ only defines REDIS_HOST + REDIS_PORT which are already in redis-cache,
    // so the BullMQ section is empty and correctly omitted
    expect(env).not.toContain('# --- BullMQ ---');
  });

  it('manifest should have envSection for both recipes', () => {
    const m = readJson(path.join(dir, '.spoonfeed.json'));
    const recipes = m.recipes as Record<string, Record<string, unknown>>;
    expect(recipes['redis-cache'].envSection).toBe('Redis Cache');
    expect(recipes.bullmq.envSection).toBe('BullMQ');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MAXIMUM RECIPE LOADING
//    Load as many non-conflicting recipes as possible into one project
// ═══════════════════════════════════════════════════════════════════════════════

describe('2. Maximum recipe loading (http-api)', () => {
  let dir: string;
  let tmpDir: string;

  // Pick a large set of non-conflicting http-api-compatible recipes
  const heavyRecipes: RecipeId[] = [
    'typeorm-postgres',
    'redis-cache',
    'bullmq',
    'jwt-auth',
    'auth-flows',
    'api-keys',
    'rbac-casl',
    'swagger',
    'pino',
    'health-checks',
    'prometheus',
    'sentry',
    'throttler',
    'helmet',
    'cors',
    'pagination',
    'filtering',
    'api-versioning',
    'correlation-id',
    'http-caching',
    'request-logging',
    'graceful-shutdown',
    'config-validation',
    'webhooks',
    'soft-delete',
    'audit-trail',
    'request-context',
    'i18n',
    'idempotency',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-heavy-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'heavy-api',
        recipes: heavyRecipes,
        deploymentTargets: ['dockerfile', 'docker-compose'],
        ciCdProvider: 'github-actions',
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 10 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0 with 29 recipes', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (heavy):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have all recipe deps (spot-check)', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/typeorm']).toBeDefined();
    expect(deps.bullmq).toBeDefined();
    expect(deps['@nestjs/jwt']).toBeDefined();
    expect(deps['@nestjs/swagger']).toBeDefined();
    expect(deps['nestjs-pino']).toBeDefined();
    expect(deps['@nestjs/throttler']).toBeDefined();
    expect(deps['@casl/ability']).toBeDefined();
    expect(deps['nestjs-i18n']).toBeDefined();
  });

  it('manifest should list all 29 recipes', () => {
    const m = readJson(path.join(dir, '.spoonfeed.json'));
    const recipes = m.recipes as Record<string, unknown>;
    expect(Object.keys(recipes)).toHaveLength(heavyRecipes.length);
  });

  it('main.ts should have swagger and helmet blocks injected', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('// --- swagger start ---');
    expect(main).toContain('// --- swagger end ---');
    expect(main).toContain('// --- helmet start ---');
    expect(main).toContain('// --- helmet end ---');
  });

  it('Dockerfile and docker-compose.yml should exist', () => {
    expect(exists(path.join(dir, 'Dockerfile'))).toBe(true);
    expect(exists(path.join(dir, 'docker-compose.yml'))).toBe(true);
  });

  it('.github/workflows/ci.yml should exist', () => {
    expect(exists(path.join(dir, '.github', 'workflows', 'ci.yml'))).toBe(true);
  });

  it('CLAUDE.md should contain sections for all AI-context recipes', () => {
    const claude = readText(path.join(dir, 'CLAUDE.md'));
    // Spot check a few
    expect(claude).toContain('@spoonfeed:typeorm-postgres');
    expect(claude).toContain('@spoonfeed:swagger');
    expect(claude).toContain('@spoonfeed:pino');
    expect(claude).toContain('@spoonfeed:jwt-auth');
  });

  it('.env.example should not have duplicate keys', () => {
    const env = readText(path.join(dir, '.env.example'));
    const keys = env
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split('=')[0]);
    const seen = new Map<string, number>();
    for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k);
    if (dupes.length > 0) {
      process.stderr.write(`Duplicate env keys: ${dupes.join(', ')}\n`);
    }
    expect(dupes).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FULL-STACK + HEAVY RECIPES — workspace path correctness
// ═══════════════════════════════════════════════════════════════════════════════

describe('3. Full-stack + heavy recipes (workspace paths)', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'drizzle-postgres',
    'redis-cache',
    'jwt-auth',
    'swagger',
    'pino',
    'health-checks',
    'helmet',
    'cors',
    'throttler',
    'config-validation',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-fsheavy-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'fs-heavy',
        projectType: 'full-stack',
        frontendFramework: 'vite-react',
        recipes,
        deploymentTargets: ['dockerfile'],
        ciCdProvider: 'github-actions',
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 10 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('recipe template files should be under apps/api/, not root src/', () => {
    // drizzle-postgres should be in apps/api/src/infrastructure/database/
    expect(exists(path.join(dir, 'apps', 'api', 'src', 'infrastructure', 'database'))).toBe(true);
    // should NOT be at root src/infrastructure/database/
    expect(exists(path.join(dir, 'src', 'infrastructure'))).toBe(false);
  });

  it('main.ts should be in apps/api/src/ and contain swagger + helmet blocks', () => {
    const main = readText(path.join(dir, 'apps', 'api', 'src', 'main.ts'));
    expect(main).toContain('// --- swagger start ---');
    expect(main).toContain('// --- helmet start ---');
    expect(main).toContain('FastifyAdapter');
  });

  it('root src/ directory should not exist', () => {
    expect(exists(path.join(dir, 'src'))).toBe(false);
  });

  it('nest-cli.json sourceRoot should point to apps/api/src', () => {
    const nc = readJson(path.join(dir, 'nest-cli.json'));
    expect(nc.sourceRoot).toBe('apps/api/src');
  });

  it('tsconfig paths should be apps/api/src/*', () => {
    const tc = readJson(path.join(dir, 'tsconfig.json'));
    const paths = (tc.compilerOptions as Record<string, unknown>).paths as Record<string, string[]>;
    expect(paths['@/*']).toEqual(['apps/api/src/*']);
  });

  it('vite-react frontend should type-check', async () => {
    const r = await tsc(dir, 'apps/web/tsconfig.json');
    if (r.exitCode !== 0) process.stderr.write(`Frontend TS:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('root package.json build script should use nx (bug 1 fix)', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.build).toContain('nx');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AWS-LAMBDA + AWS CLOUD RECIPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('4. aws-lambda + AWS cloud recipes', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'aws-sqs',
    'aws-sns',
    'aws-secrets-manager',
    'aws-s3',
    'aws-dynamodb',
    'swagger',
    'pino',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-lambda-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'lambda-api',
        projectType: 'aws-lambda',
        cloudProvider: 'aws',
        recipes,
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('main.ts should export a handler function (lambda pattern)', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('export const handler');
    expect(main).toContain('awsLambdaFastify');
  });

  it('main.ts should have swagger block after app.init() (lambda anchor)', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('// --- swagger start ---');
    const swaggerIdx = main.indexOf('// --- swagger start ---');
    const initIdx = main.indexOf('await app.init()');
    // insertBlockToString uses app.init() as secondary anchor, inserting AFTER it
    expect(swaggerIdx).toBeGreaterThan(initIdx);
  });

  it('package.json should have AWS SDK deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@aws-sdk/client-sqs']).toBeDefined();
    expect(deps['@aws-sdk/client-sns']).toBeDefined();
    expect(deps['@aws-sdk/client-s3']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MICROSERVICE + TRANSPORT — no HTTP, no Fastify
// ═══════════════════════════════════════════════════════════════════════════════

describe('5. Microservice + nats transport', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-micro-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'micro-svc',
        projectType: 'microservice',
        transportLayer: 'nats',
        recipes: ['pino', 'health-checks', 'graceful-shutdown', 'config-validation'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('main.ts should use createMicroservice, not create()', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('createMicroservice');
    expect(main).not.toContain('FastifyAdapter');
  });

  it('should NOT have helmet, swagger, or csrf (incompatible)', () => {
    const m = readJson(path.join(dir, '.spoonfeed.json'));
    const recipes = m.recipes as Record<string, unknown>;
    expect(recipes.helmet).toBeUndefined();
    expect(recipes.swagger).toBeUndefined();
    expect(recipes.csrf).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CLI-APP — no HTTP at all
// ═══════════════════════════════════════════════════════════════════════════════

describe('6. cli-app project type', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-cli-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'my-cli',
        projectType: 'cli-app',
        recipes: ['graceful-shutdown', 'config-validation'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('main.ts should use CommandFactory, not NestFactory.create()', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('CommandFactory');
    expect(main).not.toContain('FastifyAdapter');
  });

  it('should not have Fastify runtime deps (ok in devDeps for shared type-checking)', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const runtimeDeps = pkg.dependencies as Record<string, string>;
    const fastifyRuntime = Object.keys(runtimeDeps).filter((k) => k.includes('fastify'));
    expect(fastifyRuntime).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SCHEDULED-WORKER — createApplicationContext (no HTTP)
// ═══════════════════════════════════════════════════════════════════════════════

describe('7. scheduled-worker project type', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-worker-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'my-worker',
        projectType: 'scheduled-worker',
        recipes: ['bullmq', 'pino', 'health-checks', 'prisma', 'config-validation'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('main.ts should use createApplicationContext', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('createApplicationContext');
    expect(main).not.toContain('FastifyAdapter');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SCOPED PACKAGE NAME — @org/name threading
// ═══════════════════════════════════════════════════════════════════════════════

describe('8. Scoped package name (@org/name)', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-scope-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'my-api',
        scope: '@acme',
        recipes: ['swagger'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
  });
  afterAll(() => fsExtra.remove(tmpDir));

  it('package.json name should be @acme/my-api', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    expect(pkg.name).toBe('@acme/my-api');
  });

  it('CLAUDE.md should not contain EJS artifacts (<%= or <%)', () => {
    const claude = readText(path.join(dir, 'CLAUDE.md'));
    expect(claude).not.toContain('<%=');
    expect(claude).not.toContain('<%');
  });

  it('no file in the project should contain raw EJS tags', () => {
    const walk = (d: string): string[] => {
      const out: string[] = [];
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.name === 'node_modules' || e.name === '.git') continue;
        if (e.isDirectory()) out.push(...walk(fp));
        else out.push(fp);
      }
      return out;
    };
    const files = walk(dir);
    const textExts = ['.ts', '.js', '.json', '.yml', '.yaml', '.md', '.mdc', '.env', '.example'];
    const ejsLeaks: string[] = [];
    for (const f of files) {
      if (!textExts.some((ext) => f.endsWith(ext))) continue;
      const content = fs.readFileSync(f, 'utf-8');
      if (content.includes('<%=') || content.includes('<%_') || content.includes('<%#')) {
        ejsLeaks.push(path.relative(dir, f));
      }
    }
    if (ejsLeaks.length > 0) process.stderr.write(`EJS leaks: ${ejsLeaks.join(', ')}\n`);
    expect(ejsLeaks).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. MONOREPO + ALL CI/CD PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('9. Monorepo + Azure DevOps CI', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-mono-ci-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'my-mono',
        projectType: 'monorepo',
        recipes: ['typeorm-postgres', 'swagger', 'pino', 'helmet'],
        ciCdProvider: 'azure-devops',
        deploymentTargets: ['kubernetes'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('azure-pipelines.yml should exist', () => {
    expect(exists(path.join(dir, 'azure-pipelines.yml'))).toBe(true);
  });

  it('kubernetes manifests should exist', () => {
    expect(exists(path.join(dir, 'k8s')) || exists(path.join(dir, 'kubernetes'))).toBe(true);
  });

  it('main.ts should be in apps/api/src/ with swagger + helmet blocks', () => {
    const main = readText(path.join(dir, 'apps', 'api', 'src', 'main.ts'));
    expect(main).toContain('// --- swagger start ---');
    expect(main).toContain('// --- helmet start ---');
  });

  it('recipe files should be under apps/api/', () => {
    expect(
      exists(path.join(dir, 'apps', 'api', 'src', 'infrastructure', 'database')),
    ).toBe(true);
  });

  it('root package.json build script should use nx (monorepo)', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.build).toContain('nx');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. GCP CLOUD RECIPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('10. http-api + GCP cloud recipes', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-gcp-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'gcp-api',
        cloudProvider: 'gcp',
        recipes: [
          'gcp-pubsub',
          'gcp-secret-manager',
          'gcp-cloud-storage',
          'gcp-cloud-logging',
          'prisma',
          'swagger',
          'pino',
          'helmet',
        ],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have GCP SDK deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@google-cloud/pubsub']).toBeDefined();
    expect(deps['@google-cloud/secret-manager']).toBeDefined();
    expect(deps['@google-cloud/storage']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. AZURE CLOUD RECIPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('11. http-api + Azure cloud recipes', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-azure-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'azure-api',
        cloudProvider: 'azure',
        recipes: [
          'azure-service-bus',
          'azure-key-vault',
          'azure-blob-storage',
          'azure-entra-id',
          'azure-app-insights',
          'drizzle-postgres',
          'swagger',
          'pino',
          'helmet',
        ],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have Azure SDK deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@azure/service-bus']).toBeDefined();
    expect(deps['@azure/keyvault-secrets']).toBeDefined();
    expect(deps['@azure/storage-blob']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. EXPRESS HTTP-API + HEAVY RECIPES — adapter swap with full recipe set
// ═══════════════════════════════════════════════════════════════════════════════

describe('12. Express http-api + heavy recipes', () => {
  let dir: string;
  let tmpDir: string;

  const heavyRecipes: RecipeId[] = [
    'typeorm-postgres',
    'redis-cache',
    'bullmq',
    'jwt-auth',
    'auth-flows',
    'api-keys',
    'rbac-casl',
    'swagger',
    'pino',
    'health-checks',
    'prometheus',
    'sentry',
    'throttler',
    'helmet',
    'cors',
    'csrf',
    'pagination',
    'filtering',
    'api-versioning',
    'correlation-id',
    'http-caching',
    'request-logging',
    'graceful-shutdown',
    'config-validation',
    'webhooks',
    'soft-delete',
    'audit-trail',
    'request-context',
    'i18n',
    'idempotency',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-heavy-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-heavy',
        httpAdapter: 'express',
        recipes: heavyRecipes,
        deploymentTargets: ['dockerfile'],
        ciCdProvider: 'github-actions',
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 10 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0 with 30 recipes on Express', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-heavy):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('main.ts should use NestFactory.create(AppModule), not FastifyAdapter', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('NestFactory.create(AppModule)');
    expect(main).not.toContain('FastifyAdapter');
    expect(main).not.toContain('NestFastifyApplication');
    expect(main).not.toContain('fastifyEtag');
  });

  it('main.ts should have helmet block using app.use(), not app.register()', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('// --- helmet start ---');
    expect(main).toContain('// --- helmet end ---');
    expect(main).toContain("from 'helmet'");
    expect(main).not.toContain("from '@fastify/helmet'");
    expect(main).toContain('app.use(');
  });

  it('package.json should have Express deps, not Fastify deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;

    expect(deps['@nestjs/platform-express']).toBeDefined();
    expect(deps['express']).toBeDefined();
    expect(deps['@nestjs/platform-fastify']).toBeUndefined();
    expect(deps['fastify']).toBeUndefined();
    expect(deps['@fastify/etag']).toBeUndefined();
  });

  it('helmet should use helmet (npm), not @fastify/helmet', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['helmet']).toBeDefined();
    expect(deps['@fastify/helmet']).toBeUndefined();
  });

  it('csrf should use csrf-csrf, not @fastify/csrf-protection', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['csrf-csrf']).toBeDefined();
    expect(deps['cookie-parser']).toBeDefined();
    expect(deps['@fastify/csrf-protection']).toBeUndefined();
    expect(deps['@fastify/cookie']).toBeUndefined();
  });

  it('http-exception.filter.ts should import from express, not fastify', () => {
    const filter = readText(path.join(dir, 'src/shared/filters/http-exception.filter.ts'));
    expect(filter).toContain("from 'express'");
    expect(filter).not.toContain('FastifyReply');
    expect(filter).not.toContain('FastifyRequest');
  });

  it('request-timeout.middleware.ts should use Express types', () => {
    const mw = readText(path.join(dir, 'src/shared/middleware/request-timeout.middleware.ts'));
    expect(mw).toContain('Request, Response, NextFunction');
    expect(mw).not.toContain('FastifyRequest');
  });

  it('e2e test should use INestApplication, not NestFastifyApplication', () => {
    const e2e = readText(path.join(dir, 'tests/e2e/app.e2e-spec.ts'));
    expect(e2e).toContain('INestApplication');
    expect(e2e).not.toContain('NestFastifyApplication');
    expect(e2e).not.toContain('FastifyAdapter');
  });

  it('.env.example should not have duplicate keys', () => {
    const env = readText(path.join(dir, '.env.example'));
    const keys = env
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split('=')[0]);
    const seen = new Map<string, number>();
    for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k);
    expect(dupes).toEqual([]);
  });

  it('no file should contain raw EJS tags', () => {
    const walk = (d: string): string[] => {
      const out: string[] = [];
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.name === 'node_modules' || e.name === '.git') continue;
        if (e.isDirectory()) out.push(...walk(fp));
        else out.push(fp);
      }
      return out;
    };
    const files = walk(dir);
    const textExts = ['.ts', '.js', '.json', '.yml', '.yaml', '.md', '.mdc', '.env', '.example'];
    const ejsLeaks: string[] = [];
    for (const f of files) {
      if (!textExts.some((ext) => f.endsWith(ext))) continue;
      const content = fs.readFileSync(f, 'utf-8');
      if (content.includes('<%=') || content.includes('<%_') || content.includes('<%#')) {
        ejsLeaks.push(path.relative(dir, f));
      }
    }
    expect(ejsLeaks).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. EXPRESS AWS-LAMBDA + AWS CLOUD RECIPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('13. Express aws-lambda + AWS cloud recipes', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'aws-sqs',
    'aws-sns',
    'aws-secrets-manager',
    'aws-s3',
    'aws-dynamodb',
    'swagger',
    'pino',
    'helmet',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-lambda-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-lambda',
        projectType: 'aws-lambda',
        cloudProvider: 'aws',
        httpAdapter: 'express',
        recipes,
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-lambda):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('main.ts should use ExpressAdapter and serverlessExpress, not FastifyAdapter', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('ExpressAdapter');
    expect(main).toContain('serverlessExpress');
    expect(main).toContain('export const handler');
    expect(main).not.toContain('FastifyAdapter');
    expect(main).not.toContain('awsLambdaFastify');
  });

  it('package.json should have @codegenie/serverless-express, not @fastify/aws-lambda', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/platform-express']).toBeDefined();
    expect(deps['express']).toBeDefined();
    expect(deps['@codegenie/serverless-express']).toBeDefined();
    expect(deps['@fastify/aws-lambda']).toBeUndefined();
    expect(deps['@nestjs/platform-fastify']).toBeUndefined();
    expect(deps['fastify']).toBeUndefined();
  });

  it('package.json should have AWS SDK deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@aws-sdk/client-sqs']).toBeDefined();
    expect(deps['@aws-sdk/client-sns']).toBeDefined();
    expect(deps['@aws-sdk/client-s3']).toBeDefined();
  });

  it('helmet should use helmet (npm), not @fastify/helmet', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['helmet']).toBeDefined();
    expect(deps['@fastify/helmet']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. EXPRESS FULL-STACK + WORKSPACE — adapter swap in workspace layout
// ═══════════════════════════════════════════════════════════════════════════════

describe('14. Express full-stack + heavy recipes (workspace)', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'drizzle-postgres',
    'redis-cache',
    'jwt-auth',
    'swagger',
    'pino',
    'health-checks',
    'helmet',
    'cors',
    'csrf',
    'throttler',
    'config-validation',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-fs-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-fullstack',
        projectType: 'full-stack',
        httpAdapter: 'express',
        frontendFramework: 'nextjs',
        recipes,
        deploymentTargets: ['dockerfile'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 10 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-fs):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('apps/api/src/main.ts should use NestFactory.create, not FastifyAdapter', () => {
    const main = readText(path.join(dir, 'apps', 'api', 'src', 'main.ts'));
    expect(main).toContain('NestFactory.create(AppModule)');
    expect(main).toContain('enableCors');
    expect(main).not.toContain('FastifyAdapter');
    expect(main).not.toContain('NestFastifyApplication');
  });

  it('apps/api/src/main.ts should have helmet + swagger blocks', () => {
    const main = readText(path.join(dir, 'apps', 'api', 'src', 'main.ts'));
    expect(main).toContain('// --- helmet start ---');
    expect(main).toContain('// --- swagger start ---');
  });

  it('root src/ directory should not exist', () => {
    expect(exists(path.join(dir, 'src'))).toBe(false);
  });

  it('recipe files should be under apps/api/', () => {
    expect(exists(path.join(dir, 'apps', 'api', 'src', 'infrastructure', 'database'))).toBe(true);
    expect(exists(path.join(dir, 'src', 'infrastructure'))).toBe(false);
  });

  it('Express filter and middleware types under apps/api/', () => {
    const filter = readText(
      path.join(dir, 'apps', 'api', 'src', 'shared', 'filters', 'http-exception.filter.ts'),
    );
    expect(filter).toContain("from 'express'");
    expect(filter).not.toContain('FastifyReply');

    const mw = readText(
      path.join(dir, 'apps', 'api', 'src', 'shared', 'middleware', 'request-timeout.middleware.ts'),
    );
    expect(mw).toContain('Request, Response, NextFunction');
  });

  it('package.json should have Express deps and nx scripts', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    const scripts = pkg.scripts as Record<string, string>;

    expect(deps['@nestjs/platform-express']).toBeDefined();
    expect(deps['@nestjs/platform-fastify']).toBeUndefined();
    expect(scripts.build).toContain('nx');
  });

  it('helmet should use helmet (npm), csrf should use csrf-csrf', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['helmet']).toBeDefined();
    expect(deps['@fastify/helmet']).toBeUndefined();
    expect(deps['csrf-csrf']).toBeDefined();
    expect(deps['@fastify/csrf-protection']).toBeUndefined();
  });

  it('frontend type-checks', async () => {
    const r = await tsc(dir, 'apps/web/tsconfig.json');
    if (r.exitCode !== 0) process.stderr.write(`Frontend TS:\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. EXPRESS CROSS-CONTAMINATION CHECK
//     Ensure no Fastify-specific strings leak into Express-generated output
// ═══════════════════════════════════════════════════════════════════════════════

describe('15. Express cross-contamination: no Fastify leaks in generated code', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-xcontam-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'xcontam-check',
        httpAdapter: 'express',
        recipes: ['swagger', 'helmet', 'cors', 'csrf', 'pino'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
  });
  afterAll(() => fsExtra.remove(tmpDir));

  it('no .ts file in src/ should import from fastify or @fastify/*', () => {
    const walk = (d: string): string[] => {
      const out: string[] = [];
      if (!fs.existsSync(d)) return out;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.isDirectory()) out.push(...walk(fp));
        else if (e.name.endsWith('.ts')) out.push(fp);
      }
      return out;
    };

    const tsFiles = walk(path.join(dir, 'src'));
    const fastifyImports: string[] = [];

    for (const f of tsFiles) {
      const content = fs.readFileSync(f, 'utf-8');
      // Check for imports from fastify or @fastify/* packages
      if (/from\s+['"](?:fastify|@fastify\/)/.test(content)) {
        fastifyImports.push(path.relative(dir, f));
      }
      // Check for Fastify type references
      if (/FastifyAdapter|NestFastifyApplication|FastifyReply|FastifyRequest/.test(content)) {
        fastifyImports.push(`${path.relative(dir, f)} (type reference)`);
      }
    }

    if (fastifyImports.length > 0) {
      process.stderr.write(`Fastify leaks in Express project:\n${fastifyImports.join('\n')}\n`);
    }
    expect(fastifyImports).toEqual([]);
  });

  it('package.json runtime deps should not include any fastify package', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    const fastifyDeps = Object.keys(deps).filter(
      (k) => k === 'fastify' || k.startsWith('@fastify/'),
    );
    expect(fastifyDeps).toEqual([]);
  });

  it('e2e test should not reference Fastify types', () => {
    const e2e = readText(path.join(dir, 'tests/e2e/app.e2e-spec.ts'));
    expect(e2e).not.toContain('FastifyAdapter');
    expect(e2e).not.toContain('NestFastifyApplication');
    expect(e2e).not.toContain('.ready()');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. FASTIFY CROSS-CONTAMINATION CHECK (reverse)
//     Ensure no Express-specific strings leak into Fastify-generated output
// ═══════════════════════════════════════════════════════════════════════════════

describe('16. Fastify cross-contamination: no Express leaks in generated code', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-xcontam-fast-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'fastify-xcontam',
        httpAdapter: 'fastify',
        recipes: ['swagger', 'helmet', 'cors', 'csrf', 'pino'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
  });
  afterAll(() => fsExtra.remove(tmpDir));

  it('no .ts file in src/ should import from express', () => {
    const walk = (d: string): string[] => {
      const out: string[] = [];
      if (!fs.existsSync(d)) return out;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.isDirectory()) out.push(...walk(fp));
        else if (e.name.endsWith('.ts')) out.push(fp);
      }
      return out;
    };

    const tsFiles = walk(path.join(dir, 'src'));
    const expressImports: string[] = [];

    for (const f of tsFiles) {
      const content = fs.readFileSync(f, 'utf-8');
      if (/from\s+['"]express['"]/.test(content)) {
        expressImports.push(path.relative(dir, f));
      }
      if (/ExpressAdapter/.test(content)) {
        expressImports.push(`${path.relative(dir, f)} (type reference)`);
      }
    }

    if (expressImports.length > 0) {
      process.stderr.write(`Express leaks in Fastify project:\n${expressImports.join('\n')}\n`);
    }
    expect(expressImports).toEqual([]);
  });

  it('package.json runtime deps should not include express or @nestjs/platform-express', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['express']).toBeUndefined();
    expect(deps['@nestjs/platform-express']).toBeUndefined();
  });

  it('package.json should have @fastify/helmet, not bare helmet', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@fastify/helmet']).toBeDefined();
    expect(deps['helmet']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. EXPRESS MONOREPO + AZURE — adapter in workspace with CI/CD
// ═══════════════════════════════════════════════════════════════════════════════

describe('17. Express monorepo + Azure DevOps', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-mono-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-mono',
        projectType: 'monorepo',
        httpAdapter: 'express',
        recipes: ['typeorm-postgres', 'swagger', 'pino', 'helmet', 'adminjs'],
        ciCdProvider: 'azure-devops',
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-mono):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('apps/api/src/main.ts should use Express, not Fastify', () => {
    const main = readText(path.join(dir, 'apps', 'api', 'src', 'main.ts'));
    expect(main).toContain('NestFactory.create(AppModule)');
    expect(main).not.toContain('FastifyAdapter');
  });

  it('adminjs should use @adminjs/express, not @adminjs/fastify', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@adminjs/express']).toBeDefined();
    expect(deps['@adminjs/fastify']).toBeUndefined();
  });

  it('helmet should use helmet (npm), not @fastify/helmet', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['helmet']).toBeDefined();
    expect(deps['@fastify/helmet']).toBeUndefined();
  });

  it('azure-pipelines.yml should exist', () => {
    expect(exists(path.join(dir, 'azure-pipelines.yml'))).toBe(true);
  });

  it('root src/ should not exist', () => {
    expect(exists(path.join(dir, 'src'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. ADAPTER PARITY — same recipes produce same structure (minus adapter files)
//     Generate the same config with Express and Fastify, verify structural match
// ═══════════════════════════════════════════════════════════════════════════════

describe('18. Adapter parity: Express vs Fastify produce same file structure', () => {
  let expressDir: string;
  let fastifyDir: string;
  let tmpDir: string;

  function collectFiles(rootDir: string): Set<string> {
    const out = new Set<string>();
    const walk = (d: string): void => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.name === 'node_modules' || e.name === '.git') continue;
        if (e.isDirectory()) walk(fp);
        else out.add(path.relative(rootDir, fp));
      }
    };
    walk(rootDir);
    return out;
  }

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-parity-'));
    expressDir = path.join(tmpDir, 'express');
    fastifyDir = path.join(tmpDir, 'fastify');

    const registry = new RecipeRegistry();
    registerAllRecipes(registry);

    const sharedRecipes: RecipeId[] = ['swagger', 'pino', 'jwt-auth', 'health-checks', 'cors'];

    await Promise.all([
      generate(
        makeConfig({
          name: 'parity-test',
          httpAdapter: 'express',
          recipes: sharedRecipes,
          outputDir: expressDir,
        }),
        registry,
        TEMPLATES_DIR,
      ),
      generate(
        makeConfig({
          name: 'parity-test',
          httpAdapter: 'fastify',
          recipes: sharedRecipes,
          outputDir: fastifyDir,
        }),
        registry,
        TEMPLATES_DIR,
      ),
    ]);
  });
  afterAll(() => fsExtra.remove(tmpDir));

  it('both adapters should produce the exact same set of files', () => {
    const expressFiles = collectFiles(expressDir);
    const fastifyFiles = collectFiles(fastifyDir);

    const onlyExpress = [...expressFiles].filter((f) => !fastifyFiles.has(f));
    const onlyFastify = [...fastifyFiles].filter((f) => !expressFiles.has(f));

    if (onlyExpress.length > 0 || onlyFastify.length > 0) {
      process.stderr.write(
        `File mismatch:\n  Express-only: ${onlyExpress.join(', ') || '(none)'}\n  Fastify-only: ${onlyFastify.join(', ') || '(none)'}\n`,
      );
    }
    expect(onlyExpress).toEqual([]);
    expect(onlyFastify).toEqual([]);
  });

  it('both adapters should produce the same recipe entries in manifest', () => {
    const eManifest = readJson(path.join(expressDir, '.spoonfeed.json'));
    const fManifest = readJson(path.join(fastifyDir, '.spoonfeed.json'));

    const eRecipes = Object.keys(eManifest.recipes as Record<string, unknown>).sort();
    const fRecipes = Object.keys(fManifest.recipes as Record<string, unknown>).sort();
    expect(eRecipes).toEqual(fRecipes);
  });

  it('package.json should have the same number of dependencies (adapter ones differ by name)', () => {
    const ePkg = readJson(path.join(expressDir, 'package.json'));
    const fPkg = readJson(path.join(fastifyDir, 'package.json'));

    const eDeps = Object.keys(ePkg.dependencies as Record<string, string>);
    const fDeps = Object.keys(fPkg.dependencies as Record<string, string>);

    // Fastify has more granular packages (@fastify/etag, @fastify/static for swagger)
    // while Express bundles equivalents into core — allow up to 2 dep difference
    expect(Math.abs(eDeps.length - fDeps.length)).toBeLessThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. FILE-UPLOAD RECIPE WITH EXPRESS — @fastify/multipart is Fastify-specific
//     The interceptor calls request.isMultipart() and request.file(), which
//     only exist with @fastify/multipart. Express must use multer instead.
// ═══════════════════════════════════════════════════════════════════════════════

describe('19. Express + file-upload recipe (Fastify-specific API)', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-fileupload-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-upload',
        httpAdapter: 'express',
        recipes: ['file-upload', 'swagger', 'pino'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0 (interceptor compiles with Express types)', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-upload):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should not have @fastify/multipart when Express is selected', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@fastify/multipart']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. GRAPHQL MERCURIUS WITH EXPRESS — Mercurius is fundamentally Fastify-only
// ═══════════════════════════════════════════════════════════════════════════════

describe('20. Express + graphql-mercurius recipe', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-gql-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-gql',
        httpAdapter: 'express',
        recipes: ['graphql-mercurius', 'swagger', 'pino'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-gql):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have mercurius (even on Express — runtime issue, not compile)', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    // Mercurius will fail at runtime with Express, but should compile
    expect(deps['mercurius'] ?? deps['@nestjs/mercurius']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 21. FULL-STACK WITH ALL FRONTEND FRAMEWORKS
//     vite-react tested in #3, nextjs in #14 — test nuxt and sveltekit
// ═══════════════════════════════════════════════════════════════════════════════

describe('21. Full-stack: nuxt frontend type-checks', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-nuxt-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'nuxt-app',
        projectType: 'full-stack',
        frontendFramework: 'nuxt',
        recipes: ['swagger', 'pino', 'jwt-auth'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('API tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (nuxt):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('apps/web/ should contain nuxt.config', () => {
    expect(
      exists(path.join(dir, 'apps', 'web', 'nuxt.config.ts')) ||
        exists(path.join(dir, 'apps', 'web', 'nuxt.config.js')),
    ).toBe(true);
  });

  it('root package.json should have nx scripts', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.build).toContain('nx');
  });
});

describe('21b. Full-stack: sveltekit frontend type-checks', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-svelte-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'svelte-app',
        projectType: 'full-stack',
        frontendFramework: 'sveltekit',
        recipes: ['swagger', 'pino', 'jwt-auth'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('API tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (svelte):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('apps/web/ should contain svelte.config', () => {
    expect(
      exists(path.join(dir, 'apps', 'web', 'svelte.config.js')) ||
        exists(path.join(dir, 'apps', 'web', 'svelte.config.ts')),
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 22. MICROSERVICE TRANSPORT LAYERS — tcp, kafka, grpc all compile
// ═══════════════════════════════════════════════════════════════════════════════

describe('22. Microservice: transport layer variants compile', () => {
  const transports = ['tcp', 'kafka', 'grpc'] as const;
  const dirs: Record<string, { dir: string; tmpDir: string }> = {};

  beforeAll(async () => {
    const promises = transports.map(async (transport) => {
      const tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), `rt-micro-${transport}-`));
      const dir = path.join(tmpDir, 'proj');
      dirs[transport] = { dir, tmpDir };
      await generate(
        makeConfig({
          name: `micro-${transport}`,
          projectType: 'microservice',
          transportLayer: transport,
          recipes: ['pino', 'health-checks', 'config-validation'],
          outputDir: dir,
        }),
        registry,
        TEMPLATES_DIR,
      );
      await pnpmInstall(dir);
    });
    await Promise.all(promises);
  }, 10 * 60 * 1000);

  afterAll(async () => {
    await Promise.all(transports.map((t) => fsExtra.remove(dirs[t].tmpDir)));
  });

  for (const transport of transports) {
    it(`${transport}: tsc --noEmit should exit 0`, async () => {
      const r = await tsc(dirs[transport].dir);
      if (r.exitCode !== 0) {
        process.stderr.write(`TS errors (micro-${transport}):\n${r.stdout}\n${r.stderr}\n`);
      }
      expect(r.exitCode).toBe(0);
    });

    it(`${transport}: main.ts should contain createMicroservice`, () => {
      const main = readText(path.join(dirs[transport].dir, 'src/main.ts'));
      expect(main).toContain('createMicroservice');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 23. DUPLICATE RECIPES — config.recipes has the same recipe twice
// ═══════════════════════════════════════════════════════════════════════════════

describe('23. Duplicate recipes in config', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-dupe-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'dupe-test',
        recipes: ['swagger', 'swagger', 'pino', 'pino', 'jwt-auth'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
  });
  afterAll(() => fsExtra.remove(tmpDir));

  it('should not produce duplicate dependencies in package.json', () => {
    const raw = readText(path.join(dir, 'package.json'));
    // Parse and re-stringify — if there are JSON-level dupes, the parse drops them
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const deps = parsed.dependencies as Record<string, string>;

    // Check that the raw JSON doesn't contain the same key twice (crude check)
    const depsSection = raw.slice(raw.indexOf('"dependencies"'));
    const swaggerMatches = depsSection.match(/"@nestjs\/swagger"/g);
    expect(swaggerMatches?.length ?? 0).toBeLessThanOrEqual(1);

    // Verify deps are present
    expect(deps['@nestjs/swagger']).toBeDefined();
    expect(deps['nestjs-pino']).toBeDefined();
    expect(deps['@nestjs/jwt']).toBeDefined();
  });

  it('should not produce duplicate env sections', () => {
    const env = readText(path.join(dir, '.env.example'));
    const swaggerSections = env.match(/# --- Swagger/g);
    expect(swaggerSections?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('manifest should not list the same recipe twice', () => {
    const m = readJson(path.join(dir, '.spoonfeed.json'));
    const recipes = Object.keys(m.recipes as Record<string, unknown>);
    const unique = [...new Set(recipes)];
    expect(recipes).toEqual(unique);
  });

  it('main.ts should not have duplicate block markers', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    const swaggerStarts = main.match(/\/\/ --- swagger start ---/g);
    expect(swaggerStarts?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 24. EXPRESS + EVERY ADAPTER-SENSITIVE RECIPE (except file-upload/mercurius)
//     Verify all recipes with expressDependencies or expressMainTsSetup compile
// ═══════════════════════════════════════════════════════════════════════════════

describe('24. Express with all adapter-sensitive recipes', () => {
  let dir: string;
  let tmpDir: string;

  // Recipes that have expressDependencies or expressMainTsSetup
  const adapterRecipes: RecipeId[] = [
    'swagger',
    'helmet',
    'csrf',
    'adminjs',
    'typeorm-postgres', // for adminjs
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-adapter-all-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-adapter-all',
        httpAdapter: 'express',
        recipes: adapterRecipes,
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (adapter-all):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('main.ts should have Express helmet block (app.use), not Fastify (app.register)', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('// --- helmet start ---');
    expect(main).toContain("from 'helmet'");
    expect(main).not.toContain("from '@fastify/helmet'");
  });

  it('package.json should have all Express-specific deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;

    // Express adapter
    expect(deps['@nestjs/platform-express']).toBeDefined();
    expect(deps['express']).toBeDefined();

    // Swagger (Express: no @fastify/static needed)
    expect(deps['@nestjs/swagger']).toBeDefined();
    expect(deps['@fastify/static']).toBeUndefined();

    // Helmet (Express)
    expect(deps['helmet']).toBeDefined();
    expect(deps['@fastify/helmet']).toBeUndefined();

    // CSRF (Express)
    expect(deps['csrf-csrf']).toBeDefined();
    expect(deps['@fastify/csrf-protection']).toBeUndefined();

    // AdminJS (Express)
    expect(deps['@adminjs/express']).toBeDefined();
    expect(deps['@adminjs/fastify']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 25. ALL CI/CD PROVIDERS PRODUCE VALID FILES
// ═══════════════════════════════════════════════════════════════════════════════

describe('25. CI/CD providers: aws-codepipeline and gcp-cloudbuild', () => {
  let awsDir: string;
  let gcpDir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-cicd-'));
    awsDir = path.join(tmpDir, 'aws');
    gcpDir = path.join(tmpDir, 'gcp');

    await Promise.all([
      generate(
        makeConfig({
          name: 'cicd-aws',
          ciCdProvider: 'aws-codepipeline',
          deploymentTargets: ['dockerfile'],
          outputDir: awsDir,
        }),
        registry,
        TEMPLATES_DIR,
      ),
      generate(
        makeConfig({
          name: 'cicd-gcp',
          ciCdProvider: 'gcp-cloudbuild',
          deploymentTargets: ['dockerfile'],
          outputDir: gcpDir,
        }),
        registry,
        TEMPLATES_DIR,
      ),
    ]);
  });
  afterAll(() => fsExtra.remove(tmpDir));

  it('aws-codepipeline: should create buildspec.yml', () => {
    expect(
      exists(path.join(awsDir, 'buildspec.yml')) ||
        exists(path.join(awsDir, 'buildspec.yaml')),
    ).toBe(true);
  });

  it('gcp-cloudbuild: should create cloudbuild.yaml', () => {
    expect(
      exists(path.join(gcpDir, 'cloudbuild.yaml')) ||
        exists(path.join(gcpDir, 'cloudbuild.yml')),
    ).toBe(true);
  });

  it('both should have Dockerfile', () => {
    expect(exists(path.join(awsDir, 'Dockerfile'))).toBe(true);
    expect(exists(path.join(gcpDir, 'Dockerfile'))).toBe(true);
  });

  it('no file should contain raw EJS tags', () => {
    const walk = (d: string): string[] => {
      const out: string[] = [];
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.name === 'node_modules' || e.name === '.git') continue;
        if (e.isDirectory()) out.push(...walk(fp));
        else out.push(fp);
      }
      return out;
    };
    const textExts = ['.ts', '.js', '.json', '.yml', '.yaml', '.md', '.mdc'];
    for (const root of [awsDir, gcpDir]) {
      const ejsLeaks: string[] = [];
      for (const f of walk(root)) {
        if (!textExts.some((ext) => f.endsWith(ext))) continue;
        const content = fs.readFileSync(f, 'utf-8');
        if (content.includes('<%=') || content.includes('<%_') || content.includes('<%#')) {
          ejsLeaks.push(path.relative(root, f));
        }
      }
      expect(ejsLeaks).toEqual([]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 26. EXPRESS + OPENTELEMETRY — instrumentation-express instead of -fastify
// ═══════════════════════════════════════════════════════════════════════════════

describe('26. Express + opentelemetry + observability stack', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'opentelemetry',
    'distributed-tracing',
    'request-logging',
    'correlation-id',
    'pino',
    'swagger',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-otel-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-otel',
        httpAdapter: 'express',
        recipes,
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-otel):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have instrumentation-express, not instrumentation-fastify', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@opentelemetry/instrumentation-express']).toBeDefined();
    expect(deps['@opentelemetry/instrumentation-fastify']).toBeUndefined();
  });

  it('tracing.ts should use ExpressInstrumentation', () => {
    const tracing = readText(
      path.join(dir, 'src/infrastructure/telemetry/tracing.ts'),
    );
    expect(tracing).toContain('ExpressInstrumentation');
    expect(tracing).not.toContain('FastifyInstrumentation');
  });

  it('middleware files should use Express types', () => {
    const corr = readText(
      path.join(dir, 'src/shared/middleware/correlation-id.middleware.ts'),
    );
    expect(corr).toContain("from 'express'");
    expect(corr).not.toContain('FastifyRequest');

    const reqLog = readText(
      path.join(dir, 'src/shared/middleware/request-logging.middleware.ts'),
    );
    expect(reqLog).toContain("from 'express'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 27. EXPRESS + AUTH STACK — jwt, auth-flows, passport, oauth, rbac, mfa
// ═══════════════════════════════════════════════════════════════════════════════

describe('27. Express + auth-heavy recipe stack', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'typeorm-postgres',
    'jwt-auth',
    'auth-flows',
    'passport',
    'oauth-google',
    'rbac-casl',
    'mfa-totp',
    'swagger',
    'pino',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-auth-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-auth',
        httpAdapter: 'express',
        recipes,
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-auth):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have auth deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/jwt']).toBeDefined();
    expect(deps['@nestjs/passport']).toBeDefined();
    expect(deps['passport-google-oauth20']).toBeDefined();
    expect(deps['@casl/ability']).toBeDefined();
    expect(deps['otplib']).toBeDefined();
  });

  it('CLAUDE.md should contain auth-related sections', () => {
    const claude = readText(path.join(dir, 'CLAUDE.md'));
    expect(claude).toContain('@spoonfeed:jwt-auth');
    expect(claude).toContain('@spoonfeed:rbac-casl');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 28. EXPRESS + DATA LAYER — prisma + seeding + soft-delete + outbox
// ═══════════════════════════════════════════════════════════════════════════════

describe('28. Express + data layer stack (prisma)', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'prisma',
    'database-seeding',
    'pagination',
    'filtering',
    'swagger',
    'pino',
    'config-validation',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-data-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-data',
        httpAdapter: 'express',
        recipes,
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-data):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have prisma deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    const devDeps = pkg.devDependencies as Record<string, string>;
    expect(deps['@prisma/client']).toBeDefined();
    expect(devDeps['prisma']).toBeDefined();
  });

  it('pagination decorator should use Express Request type', () => {
    const decorator = readText(
      path.join(dir, 'src/shared/decorators/paginate.decorator.ts'),
    );
    expect(decorator).toContain("from 'express'");
    expect(decorator).not.toContain('FastifyRequest');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 29. ALTERNATIVE ORM — kysely + Express (untested ORM)
// ═══════════════════════════════════════════════════════════════════════════════

describe('29. Express + kysely ORM', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-kysely-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-kysely',
        httpAdapter: 'express',
        recipes: ['kysely', 'swagger', 'pino', 'health-checks'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-kysely):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have kysely and pg deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['kysely']).toBeDefined();
    expect(deps['pg']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 30. ALTERNATIVE ORM — mikro-orm + Express (untested ORM)
// ═══════════════════════════════════════════════════════════════════════════════

describe('30. Express + mikro-orm', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-mikro-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-mikro',
        httpAdapter: 'express',
        recipes: ['mikro-orm', 'swagger', 'pino', 'health-checks'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-mikro):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have mikro-orm deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@mikro-orm/core']).toBeDefined();
    expect(deps['@mikro-orm/nestjs']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 31. EXPRESS + REALTIME — websockets + sse
// ═══════════════════════════════════════════════════════════════════════════════

describe('31. Express + realtime (websockets + sse)', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-realtime-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-realtime',
        httpAdapter: 'express',
        recipes: ['websockets', 'sse', 'swagger', 'pino', 'cors'],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-realtime):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('package.json should have websocket and SSE deps', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/websockets']).toBeDefined();
    expect(deps['socket.io']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 32. EXPRESS + DX RECIPES — devcontainer, docker-compose-dev, load-testing
// ═══════════════════════════════════════════════════════════════════════════════

describe('32. Express + DX recipes', () => {
  let dir: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-dx-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-dx',
        httpAdapter: 'express',
        recipes: [
          'devcontainer',
          'docker-compose-dev',
          'load-testing',
          'worker-threads',
          'changelog',
          'license',
          'dependabot-renovate',
          'swagger',
          'pino',
        ],
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-dx):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('devcontainer.json should exist', () => {
    expect(exists(path.join(dir, '.devcontainer', 'devcontainer.json'))).toBe(true);
  });

  it('no file should contain raw EJS tags', () => {
    const walk = (d: string): string[] => {
      const out: string[] = [];
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.name === 'node_modules' || e.name === '.git') continue;
        if (e.isDirectory()) out.push(...walk(fp));
        else out.push(fp);
      }
      return out;
    };
    const textExts = ['.ts', '.js', '.json', '.yml', '.yaml', '.md', '.mdc'];
    const ejsLeaks: string[] = [];
    for (const f of walk(dir)) {
      if (!textExts.some((ext) => f.endsWith(ext))) continue;
      const content = fs.readFileSync(f, 'utf-8');
      if (content.includes('<%=') || content.includes('<%_') || content.includes('<%#')) {
        ejsLeaks.push(path.relative(dir, f));
      }
    }
    expect(ejsLeaks).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 33. EXPRESS + SECURITY STACK — helmet, csrf, throttler, dpop, data-masking
// ═══════════════════════════════════════════════════════════════════════════════

describe('33. Express + security recipe stack', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'helmet',
    'csrf',
    'throttler',
    'dpop',
    'data-masking',
    'api-keys',
    'cors',
    'swagger',
    'pino',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-sec-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-sec',
        httpAdapter: 'express',
        recipes,
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-sec):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('all security deps should be Express-specific where applicable', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;

    expect(deps['helmet']).toBeDefined();
    expect(deps['@fastify/helmet']).toBeUndefined();
    expect(deps['csrf-csrf']).toBeDefined();
    expect(deps['@fastify/csrf-protection']).toBeUndefined();
    expect(deps['@nestjs/throttler']).toBeDefined();
  });

  it('dpop guard should use Express Request type', () => {
    const guard = readText(path.join(dir, 'src/shared/guards/dpop.guard.ts'));
    expect(guard).toContain("from 'express'");
    expect(guard).not.toContain('FastifyRequest');
  });

  it('api-key guard should use Express Request type', () => {
    const guard = readText(path.join(dir, 'src/shared/guards/api-key.guard.ts'));
    expect(guard).toContain("from 'express'");
    expect(guard).not.toContain('FastifyRequest');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 34. EXPRESS AWS-LAMBDA + FULL RECIPE SET — broadest Lambda combo
// ═══════════════════════════════════════════════════════════════════════════════

describe('34. Express aws-lambda + broad recipe set', () => {
  let dir: string;
  let tmpDir: string;

  const recipes: RecipeId[] = [
    'typeorm-postgres',
    'redis-cache',
    'jwt-auth',
    'swagger',
    'pino',
    'health-checks',
    'helmet',
    'cors',
    'pagination',
    'filtering',
    'api-versioning',
    'correlation-id',
    'config-validation',
    'request-context',
    'opentelemetry',
    'aws-sqs',
    'aws-secrets-manager',
  ];

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'rt-express-lambda-broad-'));
    dir = path.join(tmpDir, 'proj');
    await generate(
      makeConfig({
        name: 'express-lambda-broad',
        projectType: 'aws-lambda',
        httpAdapter: 'express',
        cloudProvider: 'aws',
        recipes,
        outputDir: dir,
      }),
      registry,
      TEMPLATES_DIR,
    );
    await pnpmInstall(dir);
  }, 8 * 60 * 1000);
  afterAll(() => fsExtra.remove(tmpDir));

  it('tsc --noEmit should exit 0', async () => {
    const r = await tsc(dir);
    if (r.exitCode !== 0) process.stderr.write(`TS errors (express-lambda-broad):\n${r.stdout}\n${r.stderr}\n`);
    expect(r.exitCode).toBe(0);
  });

  it('main.ts should use Express serverless pattern', () => {
    const main = readText(path.join(dir, 'src/main.ts'));
    expect(main).toContain('ExpressAdapter');
    expect(main).toContain('serverlessExpress');
    expect(main).toContain('export const handler');
  });

  it('opentelemetry should use Express instrumentation', () => {
    const tracing = readText(
      path.join(dir, 'src/infrastructure/telemetry/tracing.ts'),
    );
    expect(tracing).toContain('ExpressInstrumentation');
    expect(tracing).not.toContain('FastifyInstrumentation');
  });

  it('no Fastify runtime deps in package.json', () => {
    const pkg = readJson(path.join(dir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    const fastifyDeps = Object.keys(deps).filter(
      (k) => k === 'fastify' || k.startsWith('@fastify/'),
    );
    expect(fastifyDeps).toEqual([]);
  });
});
