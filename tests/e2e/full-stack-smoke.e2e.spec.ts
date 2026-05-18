/**
 * Full-Stack Smoke Tests
 *
 * These tests generate real full-stack projects, run `pnpm install`,
 * and then verify the generated TypeScript compiles cleanly.
 *
 * They are intentionally slower than unit/e2e tests because they
 * exercise the full generation → dependency install → type-check pipeline.
 *
 * Strategy:
 *   - beforeAll: generate all variants + run parallel pnpm install
 *   - individual tests: fast tsc --noEmit assertions on already-installed projects
 *   - afterAll: remove temp dirs
 *
 * Timeout: 15 minutes for the outer suite (pnpm install is the bottleneck).
 * On warm pnpm cache this takes about 1-2 minutes total.
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { spawn } from 'node:child_process';
import fsExtra from 'fs-extra';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, FrontendFramework } from '@spoonfeed/types';

jest.setTimeout(15 * 60 * 1000); // 15 minutes — pnpm install dominates

// @clack/prompts is ESM-only; must be mocked in a CJS Jest environment.
// generate() uses p.spinner() — we stub it so nothing is logged during tests.
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

// ─── Constants ───────────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');
const FRONTEND_FRAMEWORKS: FrontendFramework[] = ['nextjs', 'nuxt', 'vite-react', 'sveltekit'];

// ─── Process helpers ──────────────────────────────────────────────────────────

interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Async wrapper around child_process.spawn.
 * avoids ESM import issues with execa v9 when Jest runs in CJS mode.
 */
function spawnAsync(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 5 * 60 * 1000,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'pipe' });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on('data', (d: Buffer) => stdoutChunks.push(d));
    proc.stderr.on('data', (d: Buffer) => stderrChunks.push(d));

    const timer = setTimeout(() => {
      proc.kill();
      reject(
        new Error(`Timed out after ${timeoutMs}ms: ${cmd} ${args.join(' ')} (cwd: ${cwd})`),
      );
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runPnpmInstall(cwd: string): Promise<void> {
  const result = await spawnAsync('pnpm', ['install', '--no-frozen-lockfile'], cwd, 5 * 60 * 1000);
  if (result.exitCode !== 0) {
    throw new Error(
      `pnpm install failed in ${path.basename(cwd)}:\n${result.stderr || result.stdout}`,
    );
  }
}

async function runTscCheck(
  cwd: string,
  tsconfigPath?: string,
): Promise<{ exitCode: number; output: string }> {
  const args = ['exec', 'tsc', '--noEmit'];
  if (tsconfigPath) args.push('-p', tsconfigPath);
  const result = await spawnAsync('pnpm', args, cwd, 2 * 60 * 1000);
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  return { exitCode: result.exitCode, output };
}

// ─── Config / file helpers ────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ProjectConfig> & { outputDir: string }): ProjectConfig {
  return {
    name: 'smoke-app',
    projectType: 'full-stack',
    cloudProvider: 'aws',
    httpAdapter: 'fastify',
    recipes: [],
    deploymentTargets: [],
    frontendFramework: 'vite-react',
    outputDir: overrides.outputDir,
    ...overrides,
  };
}

function readJsonFile(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
}

function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ─── Suite 1: Base full-stack (all 4 frontends) ──────────────────────────────

describe('Full-Stack Smoke Tests › Base project (all frontends)', () => {
  let registry: RecipeRegistry;
  let baseTmpDir: string;
  const projectDirs: Partial<Record<FrontendFramework, string>> = {};

  beforeAll(async () => {
    registry = new RecipeRegistry();
    registerAllRecipes(registry);

    baseTmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'spoonfeed-smoke-base-'));

    // Generate all 4 variants (fast — no filesystem installs)
    for (const fw of FRONTEND_FRAMEWORKS) {
      const outputDir = path.join(baseTmpDir, fw);
      projectDirs[fw] = outputDir;
      await generate(
        makeConfig({ name: 'smoke-app', frontendFramework: fw, outputDir }),
        registry,
        TEMPLATES_DIR,
      );
    }

    // Install all in parallel — pnpm cache makes this fast after first run
    await Promise.all(FRONTEND_FRAMEWORKS.map((fw) => runPnpmInstall(projectDirs[fw]!)));
  }, 12 * 60 * 1000);

  afterAll(async () => {
    await fsExtra.remove(baseTmpDir);
  });

  // ── API type-check ──────────────────────────────────────────────────────────

  describe('NestJS API compiles cleanly (root tsconfig excludes apps/web)', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] tsc --noEmit exits 0`, async () => {
        const { exitCode, output } = await runTscCheck(projectDirs[fw]!);
        if (exitCode !== 0) process.stderr.write(`TypeScript errors (${fw}):\n${output}\n`);
        expect(exitCode).toBe(0);
      });
    }
  });

  // ── Frontend type-check ─────────────────────────────────────────────────────

  describe('Frontend type-check (vite-react — pure TypeScript, no codegen)', () => {
    it('[vite-react] apps/web tsc --noEmit exits 0', async () => {
      const dir = projectDirs['vite-react']!;
      const { exitCode, output } = await runTscCheck(dir, 'apps/web/tsconfig.json');
      if (exitCode !== 0) process.stderr.write(`vite-react frontend TS errors:\n${output}\n`);
      expect(exitCode).toBe(0);
    });
  });

  // ── node_modules layout ─────────────────────────────────────────────────────

  describe('pnpm install produces correct node_modules layout', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] root node_modules/@nestjs/core is installed`, () => {
        expect(fileExists(path.join(projectDirs[fw]!, 'node_modules', '@nestjs', 'core'))).toBe(
          true,
        );
      });

      it(`[${fw}] root node_modules/typescript is installed`, () => {
        expect(fileExists(path.join(projectDirs[fw]!, 'node_modules', 'typescript'))).toBe(true);
      });
    }
  });

  // ── Generated project structure ─────────────────────────────────────────────

  describe('Generated project file structure', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] apps/api/src/main.ts exists`, () => {
        expect(fileExists(path.join(projectDirs[fw]!, 'apps', 'api', 'src', 'main.ts'))).toBe(
          true,
        );
      });

      it(`[${fw}] apps/api/src/app.module.ts exists`, () => {
        expect(
          fileExists(path.join(projectDirs[fw]!, 'apps', 'api', 'src', 'app.module.ts')),
        ).toBe(true);
      });

      it(`[${fw}] apps/web directory exists`, () => {
        expect(fileExists(path.join(projectDirs[fw]!, 'apps', 'web'))).toBe(true);
      });

      it(`[${fw}] libs/shared-types/src/index.ts exists`, () => {
        expect(
          fileExists(path.join(projectDirs[fw]!, 'libs', 'shared-types', 'src', 'index.ts')),
        ).toBe(true);
      });

      it(`[${fw}] pnpm-workspace.yaml exists`, () => {
        expect(fileExists(path.join(projectDirs[fw]!, 'pnpm-workspace.yaml'))).toBe(true);
      });

      it(`[${fw}] .spoonfeed.json manifest exists`, () => {
        expect(fileExists(path.join(projectDirs[fw]!, '.spoonfeed.json'))).toBe(true);
      });
    }

    it('[nextjs] apps/web/next.config.ts exists', () => {
      expect(
        fileExists(path.join(projectDirs['nextjs']!, 'apps', 'web', 'next.config.ts')),
      ).toBe(true);
    });

    it('[nuxt] apps/web/nuxt.config.ts exists', () => {
      expect(
        fileExists(path.join(projectDirs['nuxt']!, 'apps', 'web', 'nuxt.config.ts')),
      ).toBe(true);
    });

    it('[vite-react] apps/web/vite.config.ts exists', () => {
      expect(
        fileExists(path.join(projectDirs['vite-react']!, 'apps', 'web', 'vite.config.ts')),
      ).toBe(true);
    });

    it('[sveltekit] apps/web/svelte.config.js exists', () => {
      expect(
        fileExists(path.join(projectDirs['sveltekit']!, 'apps', 'web', 'svelte.config.js')),
      ).toBe(true);
    });
  });

  // ── Root package.json ───────────────────────────────────────────────────────

  describe('Root package.json content', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] name is smoke-app`, () => {
        const pkg = readJsonFile(path.join(projectDirs[fw]!, 'package.json'));
        expect(pkg.name).toBe('smoke-app');
      });

      it(`[${fw}] has NX dev dependency`, () => {
        const pkg = readJsonFile(path.join(projectDirs[fw]!, 'package.json'));
        const devDeps = pkg.devDependencies as Record<string, string>;
        expect(devDeps.nx).toBeDefined();
      });

      it(`[${fw}] has a build script defined`, () => {
        const pkg = readJsonFile(path.join(projectDirs[fw]!, 'package.json'));
        const scripts = pkg.scripts as Record<string, string>;
        expect(scripts.build).toBeDefined();
      });
    }
  });

  // ── tsconfig paths ──────────────────────────────────────────────────────────

  describe('tsconfig.json path aliases', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] @/* maps to apps/api/src/*`, () => {
        const tsconfig = readJsonFile(path.join(projectDirs[fw]!, 'tsconfig.json'));
        const opts = tsconfig.compilerOptions as Record<string, unknown>;
        const paths = opts.paths as Record<string, string[]>;
        expect(paths['@/*']).toEqual(['apps/api/src/*']);
      });
    }
  });

  // ── nest-cli.json ───────────────────────────────────────────────────────────

  describe('nest-cli.json workspace configuration', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] sourceRoot is apps/api/src`, () => {
        const nestCli = readJsonFile(path.join(projectDirs[fw]!, 'nest-cli.json'));
        expect(nestCli.sourceRoot).toBe('apps/api/src');
      });

      it(`[${fw}] entryFile is apps/api/src/main`, () => {
        const nestCli = readJsonFile(path.join(projectDirs[fw]!, 'nest-cli.json'));
        expect(nestCli.entryFile).toBe('apps/api/src/main');
      });
    }
  });

  // ── nx.json ─────────────────────────────────────────────────────────────────

  describe('nx.json workspace configuration', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] targetDefaults.build.cache is true`, () => {
        const nxJson = readJsonFile(path.join(projectDirs[fw]!, 'nx.json'));
        const targets = nxJson.targetDefaults as Record<string, Record<string, unknown>>;
        expect(targets.build?.cache).toBe(true);
      });
    }
  });

  // ── pnpm-workspace.yaml ─────────────────────────────────────────────────────

  describe('pnpm-workspace.yaml', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] includes apps/* and libs/*`, () => {
        const content = readTextFile(path.join(projectDirs[fw]!, 'pnpm-workspace.yaml'));
        expect(content).toContain("'apps/*'");
        expect(content).toContain("'libs/*'");
      });
    }
  });

  // ── NestJS main.ts content ──────────────────────────────────────────────────

  describe('NestJS API main.ts', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] uses FastifyAdapter`, () => {
        const mainTs = readTextFile(
          path.join(projectDirs[fw]!, 'apps', 'api', 'src', 'main.ts'),
        );
        expect(mainTs).toContain('FastifyAdapter');
        expect(mainTs).toContain('NestFactory');
      });
    }
  });

  // ── shared-types content ────────────────────────────────────────────────────

  describe('libs/shared-types', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] exports ApiResponse and PaginatedResponse`, () => {
        const index = readTextFile(
          path.join(projectDirs[fw]!, 'libs', 'shared-types', 'src', 'index.ts'),
        );
        expect(index).toContain('ApiResponse');
        expect(index).toContain('PaginatedResponse');
      });
    }
  });

  // ── .spoonfeed.json manifest ────────────────────────────────────────────────

  describe('.spoonfeed.json manifest', () => {
    for (const fw of FRONTEND_FRAMEWORKS) {
      it(`[${fw}] projectType is full-stack`, () => {
        const manifest = readJsonFile(path.join(projectDirs[fw]!, '.spoonfeed.json'));
        expect(manifest.projectType).toBe('full-stack');
      });
    }
  });
});

// ─── Suite 2: Full-stack + common recipes (vite-react) ───────────────────────

describe('Full-Stack Smoke Tests › vite-react + common recipes', () => {
  let registry: RecipeRegistry;
  let tmpDir: string;
  let projectDir: string;

  beforeAll(async () => {
    registry = new RecipeRegistry();
    registerAllRecipes(registry);

    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'spoonfeed-smoke-recipes-'));
    projectDir = path.join(tmpDir, 'with-recipes');

    await generate(
      makeConfig({
        name: 'smoke-recipes',
        frontendFramework: 'vite-react',
        recipes: ['typeorm-postgres', 'jwt-auth', 'swagger', 'pino', 'health-checks'],
        outputDir: projectDir,
      }),
      registry,
      TEMPLATES_DIR,
    );

    await runPnpmInstall(projectDir);
  }, 8 * 60 * 1000);

  afterAll(async () => {
    await fsExtra.remove(tmpDir);
  });

  it('NestJS API type-checks cleanly with recipe deps', async () => {
    const { exitCode, output } = await runTscCheck(projectDir);
    if (exitCode !== 0) process.stderr.write(`TS errors with recipes:\n${output}\n`);
    expect(exitCode).toBe(0);
  });

  it('vite-react frontend type-checks cleanly', async () => {
    const { exitCode, output } = await runTscCheck(projectDir, 'apps/web/tsconfig.json');
    if (exitCode !== 0) process.stderr.write(`vite-react frontend TS errors:\n${output}\n`);
    expect(exitCode).toBe(0);
  });

  it('package.json has typeorm-postgres deps', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/typeorm']).toBeDefined();
    expect(deps.typeorm).toBeDefined();
    expect(deps.pg).toBeDefined();
  });

  it('package.json has jwt-auth deps', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/jwt']).toBeDefined();
    expect(deps['@nestjs/passport']).toBeDefined();
  });

  it('package.json has swagger dep', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/swagger']).toBeDefined();
  });

  it('package.json has nestjs-pino dep', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['nestjs-pino']).toBeDefined();
  });

  it('typeorm-postgres copies database.module.ts into apps/api/', () => {
    expect(
      fileExists(
        path.join(
          projectDir,
          'apps',
          'api',
          'src',
          'infrastructure',
          'database',
          'database.module.ts',
        ),
      ),
    ).toBe(true);
  });

  it('jwt-auth copies jwt-auth.guard.ts into apps/api/', () => {
    expect(
      fileExists(
        path.join(
          projectDir,
          'apps',
          'api',
          'src',
          'shared',
          'guards',
          'jwt-auth.guard.ts',
        ),
      ),
    ).toBe(true);
  });

  it('.spoonfeed.json lists all 5 installed recipes', () => {
    const manifest = readJsonFile(path.join(projectDir, '.spoonfeed.json'));
    const recipes = manifest.recipes as Record<string, unknown>;
    expect(Object.keys(recipes)).toHaveLength(5);
    for (const id of ['typeorm-postgres', 'jwt-auth', 'swagger', 'pino', 'health-checks']) {
      expect(recipes[id]).toBeDefined();
    }
  });

  it('.env.example contains typeorm env vars', () => {
    const env = readTextFile(path.join(projectDir, '.env.example'));
    expect(env).toContain('DB_HOST');
    expect(env).toContain('DB_PORT');
  });

  it('.env.example contains jwt env vars', () => {
    const env = readTextFile(path.join(projectDir, '.env.example'));
    expect(env).toContain('JWT_SECRET');
  });
});

// ─── Suite 3: nextjs + drizzle-postgres + redis-cache ────────────────────────

describe('Full-Stack Smoke Tests › nextjs + drizzle-postgres + redis-cache', () => {
  let registry: RecipeRegistry;
  let tmpDir: string;
  let projectDir: string;

  beforeAll(async () => {
    registry = new RecipeRegistry();
    registerAllRecipes(registry);

    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'spoonfeed-smoke-nextjs-'));
    projectDir = path.join(tmpDir, 'nextjs-drizzle');

    await generate(
      makeConfig({
        name: 'smoke-nextjs',
        frontendFramework: 'nextjs',
        recipes: ['drizzle-postgres', 'redis-cache', 'throttler'],
        outputDir: projectDir,
      }),
      registry,
      TEMPLATES_DIR,
    );

    await runPnpmInstall(projectDir);
  }, 8 * 60 * 1000);

  afterAll(async () => {
    await fsExtra.remove(tmpDir);
  });

  it('NestJS API type-checks cleanly', async () => {
    const { exitCode, output } = await runTscCheck(projectDir);
    if (exitCode !== 0) process.stderr.write(`TS errors (nextjs+drizzle):\n${output}\n`);
    expect(exitCode).toBe(0);
  });

  it('package.json has drizzle-orm dep', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['drizzle-orm']).toBeDefined();
  });

  it('package.json has ioredis dep (redis-cache)', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps.ioredis).toBeDefined();
  });

  it('package.json has @nestjs/throttler dep', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/throttler']).toBeDefined();
  });

  it('.env.example contains DATABASE_URL (drizzle)', () => {
    const env = readTextFile(path.join(projectDir, '.env.example'));
    expect(env).toContain('DATABASE_URL');
  });

  it('drizzle-postgres copies drizzle.module.ts into apps/api/', () => {
    expect(
      fileExists(
        path.join(
          projectDir,
          'apps',
          'api',
          'src',
          'infrastructure',
          'database',
          'drizzle.module.ts',
        ),
      ),
    ).toBe(true);
  });

  it('redis-cache copies cache.module.ts into apps/api/', () => {
    expect(
      fileExists(
        path.join(
          projectDir,
          'apps',
          'api',
          'src',
          'infrastructure',
          'cache',
          'cache.module.ts',
        ),
      ),
    ).toBe(true);
  });

  it('apps/web/next.config.ts exists', () => {
    expect(fileExists(path.join(projectDir, 'apps', 'web', 'next.config.ts'))).toBe(true);
  });
});

// ─── Suite 4: sveltekit + github-actions + docker deployment ─────────────────

describe('Full-Stack Smoke Tests › sveltekit + github-actions + docker', () => {
  let registry: RecipeRegistry;
  let tmpDir: string;
  let projectDir: string;

  beforeAll(async () => {
    registry = new RecipeRegistry();
    registerAllRecipes(registry);

    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'spoonfeed-smoke-svelte-'));
    projectDir = path.join(tmpDir, 'svelte-ci');

    await generate(
      makeConfig({
        name: 'smoke-svelte',
        frontendFramework: 'sveltekit',
        recipes: ['swagger', 'health-checks'],
        deploymentTargets: ['dockerfile'],
        ciCdProvider: 'github-actions',
        outputDir: projectDir,
      }),
      registry,
      TEMPLATES_DIR,
    );

    await runPnpmInstall(projectDir);
  }, 8 * 60 * 1000);

  afterAll(async () => {
    await fsExtra.remove(tmpDir);
  });

  it('NestJS API type-checks cleanly', async () => {
    const { exitCode, output } = await runTscCheck(projectDir);
    if (exitCode !== 0) process.stderr.write(`TS errors (sveltekit+ci):\n${output}\n`);
    expect(exitCode).toBe(0);
  });

  it('Dockerfile is generated at root', () => {
    expect(fileExists(path.join(projectDir, 'Dockerfile'))).toBe(true);
  });

  it('Dockerfile uses node:22-alpine base image', () => {
    const dockerfile = readTextFile(path.join(projectDir, 'Dockerfile'));
    expect(dockerfile).toContain('node:22-alpine');
  });

  it('.github/workflows/ci.yml is generated', () => {
    expect(
      fileExists(path.join(projectDir, '.github', 'workflows', 'ci.yml')),
    ).toBe(true);
  });

  it('apps/web/svelte.config.js exists', () => {
    expect(
      fileExists(path.join(projectDir, 'apps', 'web', 'svelte.config.js')),
    ).toBe(true);
  });

  it('swagger dep is in package.json', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/swagger']).toBeDefined();
  });

  it('.spoonfeed.json lists swagger and health-checks', () => {
    const manifest = readJsonFile(path.join(projectDir, '.spoonfeed.json'));
    const recipes = manifest.recipes as Record<string, unknown>;
    expect(recipes.swagger).toBeDefined();
    expect(recipes['health-checks']).toBeDefined();
  });
});

// ─── Suite 5: nuxt + prisma + bullmq ─────────────────────────────────────────

describe('Full-Stack Smoke Tests › nuxt + prisma + bullmq', () => {
  let registry: RecipeRegistry;
  let tmpDir: string;
  let projectDir: string;

  beforeAll(async () => {
    registry = new RecipeRegistry();
    registerAllRecipes(registry);

    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'spoonfeed-smoke-nuxt-'));
    projectDir = path.join(tmpDir, 'nuxt-events');

    await generate(
      makeConfig({
        name: 'smoke-nuxt',
        frontendFramework: 'nuxt',
        recipes: ['prisma', 'bullmq', 'config-validation'],
        outputDir: projectDir,
      }),
      registry,
      TEMPLATES_DIR,
    );

    await runPnpmInstall(projectDir);
  }, 8 * 60 * 1000);

  afterAll(async () => {
    await fsExtra.remove(tmpDir);
  });

  it('NestJS API type-checks cleanly', async () => {
    const { exitCode, output } = await runTscCheck(projectDir);
    if (exitCode !== 0) process.stderr.write(`TS errors (nuxt+prisma+bullmq):\n${output}\n`);
    expect(exitCode).toBe(0);
  });

  it('package.json has @prisma/client dep', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@prisma/client']).toBeDefined();
  });

  it('package.json has bullmq dep', () => {
    const pkg = readJsonFile(path.join(projectDir, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps.bullmq).toBeDefined();
  });

  it('prisma copies prisma.service.ts into apps/api/', () => {
    expect(
      fileExists(
        path.join(
          projectDir,
          'apps',
          'api',
          'src',
          'infrastructure',
          'database',
          'prisma.service.ts',
        ),
      ),
    ).toBe(true);
  });

  it('bullmq copies queue.module.ts into apps/api/', () => {
    expect(
      fileExists(
        path.join(
          projectDir,
          'apps',
          'api',
          'src',
          'infrastructure',
          'queue',
          'queue.module.ts',
        ),
      ),
    ).toBe(true);
  });

  it('apps/web/nuxt.config.ts exists', () => {
    expect(fileExists(path.join(projectDir, 'apps', 'web', 'nuxt.config.ts'))).toBe(true);
  });

  it('apps/web/pages/index.vue exists', () => {
    expect(
      fileExists(path.join(projectDir, 'apps', 'web', 'pages', 'index.vue')),
    ).toBe(true);
  });
});
