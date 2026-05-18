import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, RecipeId } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'test-project',
    scope: undefined,
    projectType: 'http-api',
    cloudProvider: 'none',
    httpAdapter: 'fastify',
    recipes: [],
    transportLayer: undefined,
    frontendFramework: undefined,
    deploymentTargets: [],
    ciCdProvider: undefined,
    outputDir: '',
    ...overrides,
  };
}

function readFile(outputDir: string, filePath: string): string {
  return fs.readFileSync(path.join(outputDir, filePath), 'utf-8');
}

function readJson(outputDir: string, filePath: string): Record<string, unknown> {
  return JSON.parse(readFile(outputDir, filePath)) as Record<string, unknown>;
}

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

/**
 * Recursively collect all file paths under `dir`, relative to `base`.
 * Skips node_modules.
 */
function collectFiles(dir: string, base: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, base));
    } else {
      results.push(path.relative(base, fullPath));
    }
  }
  return results.sort();
}

/**
 * Strips timestamps and other non-deterministic fields from the manifest
 * so two manifests can be compared structurally.
 */
function normalizeManifest(manifest: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...manifest };
  delete copy.generatedAt;
  const recipes = copy.recipes as Record<string, Record<string, unknown>> | undefined;
  if (recipes) {
    for (const recipe of Object.values(recipes)) {
      delete recipe.installedAt;
    }
  }
  return copy;
}

/**
 * Generate a project into a fresh temp directory and return its path.
 */
async function generateProject(
  registry: RecipeRegistry,
  overrides: Partial<ProjectConfig>,
): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ordering-'));
  const config = makeConfig({ ...overrides, outputDir: dir });
  await generate(config, registry, TEMPLATES_DIR);
  return dir;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Same recipes in different order: compare all outputs
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe ordering: basic reorder with cors, helmet, throttler', () => {
  const orderA: RecipeId[] = ['cors', 'helmet', 'throttler'];
  const orderB: RecipeId[] = ['throttler', 'helmet', 'cors'];

  let dirA: string;
  let dirB: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    dirA = await generateProject(registry, { recipes: [...orderA] });
    dirB = await generateProject(registry, { recipes: [...orderB] });
  });

  afterAll(() => {
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
  });

  it('should produce the same set of files regardless of recipe order', () => {
    const filesA = collectFiles(dirA, dirA);
    const filesB = collectFiles(dirB, dirB);
    expect(filesA).toEqual(filesB);
  });

  it('should produce identical package.json dependencies regardless of recipe order', () => {
    const pkgA = readJson(dirA, 'package.json');
    const pkgB = readJson(dirB, 'package.json');

    // package-json-merger.ts sorts keys, so deps should be byte-identical
    expect(pkgA.dependencies).toEqual(pkgB.dependencies);
    expect(pkgA.devDependencies).toEqual(pkgB.devDependencies);
  });

  it('should produce identical package.json scripts regardless of recipe order', () => {
    const pkgA = readJson(dirA, 'package.json');
    const pkgB = readJson(dirB, 'package.json');
    expect(pkgA.scripts).toEqual(pkgB.scripts);
  });

  it('should contain the same env var keys in .env.example regardless of order', () => {
    const envA = readFile(dirA, '.env.example');
    const envB = readFile(dirB, '.env.example');

    // Extract all KEY=VALUE lines (ignoring comments and section markers)
    const extractKeys = (content: string): string[] =>
      content
        .split('\n')
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => line.split('=')[0])
        .sort();

    expect(extractKeys(envA)).toEqual(extractKeys(envB));
  });

  it('should produce identical .env.example sections regardless of recipe order', () => {
    const envA = readFile(dirA, '.env.example');
    const envB = readFile(dirB, '.env.example');

    // Extract section marker names in order
    const extractSectionOrder = (content: string): string[] =>
      content
        .split('\n')
        .filter((line) => /^# --- .+ ---$/.test(line) && !line.startsWith('# --- end'))
        .map((line) => line.replace(/^# --- /, '').replace(/ ---$/, ''));

    const sectionsA = extractSectionOrder(envA);
    const sectionsB = extractSectionOrder(envB);

    // Sections are now sorted alphabetically by renderEnvFileWithSections,
    // so both orderings produce identical section order
    expect(sectionsA).toEqual(sectionsB);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Recipes that insert at the same anchor point (await app.listen)
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe ordering: main.ts block insertion order (swagger + helmet)', () => {
  // Both swagger and helmet have mainTsSetup blocks that insert before `await app.listen`.
  // They use different blockIds, so both should appear. But their relative position in
  // main.ts depends on which is processed first.
  const orderA: RecipeId[] = ['swagger', 'helmet'];
  const orderB: RecipeId[] = ['helmet', 'swagger'];

  let dirA: string;
  let dirB: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    dirA = await generateProject(registry, { recipes: [...orderA] });
    dirB = await generateProject(registry, { recipes: [...orderB] });
  });

  afterAll(() => {
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
  });

  it('should include both swagger and helmet blocks in main.ts regardless of order', () => {
    const mainA = readFile(dirA, 'src/main.ts');
    const mainB = readFile(dirB, 'src/main.ts');

    // Both should contain both block markers
    expect(mainA).toContain('// --- swagger start ---');
    expect(mainA).toContain('// --- swagger end ---');
    expect(mainA).toContain('// --- helmet start ---');
    expect(mainA).toContain('// --- helmet end ---');

    expect(mainB).toContain('// --- swagger start ---');
    expect(mainB).toContain('// --- swagger end ---');
    expect(mainB).toContain('// --- helmet start ---');
    expect(mainB).toContain('// --- helmet end ---');
  });

  it('should have both blocks appear before await app.listen', () => {
    const mainA = readFile(dirA, 'src/main.ts');
    const mainB = readFile(dirB, 'src/main.ts');

    for (const content of [mainA, mainB]) {
      const listenIdx = content.indexOf('await app.listen');
      const swaggerEndIdx = content.indexOf('// --- swagger end ---');
      const helmetEndIdx = content.indexOf('// --- helmet end ---');

      expect(listenIdx).toBeGreaterThan(-1);
      expect(swaggerEndIdx).toBeGreaterThan(-1);
      expect(helmetEndIdx).toBeGreaterThan(-1);
      expect(swaggerEndIdx).toBeLessThan(listenIdx);
      expect(helmetEndIdx).toBeLessThan(listenIdx);
    }
  });

  // BUG: Block insertion order in main.ts depends on recipe array order.
  // insertBlockToString always inserts before `await app.listen`, so the last-processed
  // recipe's block ends up closest to the listen line. This means the relative position
  // of swagger vs helmet blocks flips when recipe order is reversed. The generated code
  // is still valid (both blocks are independent), but the output is not deterministic
  // with respect to recipe ordering.
  it('should reveal that block order in main.ts depends on recipe array order', () => {
    const mainA = readFile(dirA, 'src/main.ts');
    const mainB = readFile(dirB, 'src/main.ts');

    const swaggerIdxA = mainA.indexOf('// --- swagger start ---');
    const helmetIdxA = mainA.indexOf('// --- helmet start ---');
    const swaggerIdxB = mainB.indexOf('// --- swagger start ---');
    const helmetIdxB = mainB.indexOf('// --- helmet start ---');

    // In order A (swagger first), swagger block is inserted first, then helmet
    // is inserted before app.listen, pushing it between swagger and listen.
    // So helmet should appear AFTER swagger in order A.
    // In order B (helmet first), the positions should be reversed.
    const swaggerBeforeHelmetInA = swaggerIdxA < helmetIdxA;
    const swaggerBeforeHelmetInB = swaggerIdxB < helmetIdxB;

    // BUG: The relative order of blocks changes based on recipe array order.
    // This is because each insertBlockToString call inserts before `await app.listen`,
    // and subsequent insertions go between the previous block and listen.
    expect(swaggerBeforeHelmetInA).not.toEqual(swaggerBeforeHelmetInB);
  });

  it('should produce valid TypeScript in main.ts regardless of block order', () => {
    const mainA = readFile(dirA, 'src/main.ts');
    const mainB = readFile(dirB, 'src/main.ts');

    for (const content of [mainA, mainB]) {
      // No duplicate import lines for the same module
      const importLines = content.split('\n').filter((l) => l.startsWith('import '));
      const importSet = new Set(importLines);
      expect(importLines.length).toEqual(importSet.size);

      // Brackets are balanced (basic sanity check)
      const opens = (content.match(/\{/g) ?? []).length;
      const closes = (content.match(/\}/g) ?? []).length;
      expect(opens).toEqual(closes);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Recipes with `requires` dependencies
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe ordering: requires dependencies', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('should identify auth-flows as a recipe that requires jwt-auth', () => {
    const authFlows = registry.get('auth-flows');
    expect(authFlows).toBeDefined();
    expect(authFlows!.requires).toEqual(['jwt-auth']);
  });

  // auth-flows requires jwt-auth. Test that putting auth-flows BEFORE jwt-auth
  // in the array still generates a valid project. The generator does NOT
  // topologically sort recipes -- it processes them in array order.
  describe('auth-flows before jwt-auth (dependency listed after dependent)', () => {
    // Put auth-flows first (before its dependency jwt-auth)
    const recipesWrongOrder: RecipeId[] = ['auth-flows', 'jwt-auth'];
    const recipesCorrectOrder: RecipeId[] = ['jwt-auth', 'auth-flows'];

    let dirWrong: string;
    let dirCorrect: string;

    beforeAll(async () => {
      dirWrong = await generateProject(registry, { recipes: [...recipesWrongOrder] });
      dirCorrect = await generateProject(registry, { recipes: [...recipesCorrectOrder] });
    });

    afterAll(() => {
      fs.rmSync(dirWrong, { recursive: true, force: true });
      fs.rmSync(dirCorrect, { recursive: true, force: true });
    });

    it('should produce the same set of files regardless of dependency order', () => {
      const filesWrong = collectFiles(dirWrong, dirWrong);
      const filesCorrect = collectFiles(dirCorrect, dirCorrect);
      expect(filesWrong).toEqual(filesCorrect);
    });

    it('should produce identical package.json deps regardless of dependency order', () => {
      const pkgWrong = readJson(dirWrong, 'package.json');
      const pkgCorrect = readJson(dirCorrect, 'package.json');
      expect(pkgWrong.dependencies).toEqual(pkgCorrect.dependencies);
      expect(pkgWrong.devDependencies).toEqual(pkgCorrect.devDependencies);
    });

    it('should produce valid main.ts in both orderings', () => {
      const mainWrong = readFile(dirWrong, 'src/main.ts');
      const mainCorrect = readFile(dirCorrect, 'src/main.ts');

      for (const content of [mainWrong, mainCorrect]) {
        // Balanced braces
        const opens = (content.match(/\{/g) ?? []).length;
        const closes = (content.match(/\}/g) ?? []).length;
        expect(opens).toEqual(closes);

        // No duplicate imports
        const importLines = content.split('\n').filter((l) => l.startsWith('import '));
        expect(importLines.length).toEqual(new Set(importLines).size);
      }
    });

    it('should contain the same env var keys regardless of dependency order', () => {
      const envWrong = readFile(dirWrong, '.env.example');
      const envCorrect = readFile(dirCorrect, '.env.example');

      const extractKeys = (content: string): string[] =>
        content
          .split('\n')
          .filter((line) => /^[A-Z_]+=/.test(line))
          .map((line) => line.split('=')[0])
          .sort();

      expect(extractKeys(envWrong)).toEqual(extractKeys(envCorrect));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Large recipe set (10+) — verify main.ts validity
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe ordering: large recipe set (10+ recipes)', () => {
  const LARGE_RECIPE_SET: RecipeId[] = [
    'swagger',
    'pino',
    'jwt-auth',
    'helmet',
    'cors',
    'health-checks',
    'correlation-id',
    'pagination',
    'sentry',
    'opentelemetry',
    'throttler',
    'graceful-shutdown',
  ];

  let dir: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    dir = await generateProject(registry, { recipes: [...LARGE_RECIPE_SET] });
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should generate a project with 12 recipes without errors', () => {
    expect(fs.existsSync(path.join(dir, 'src/main.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.env.example'))).toBe(true);
  });

  it('should have no duplicate import lines in main.ts', () => {
    const mainTs = readFile(dir, 'src/main.ts');
    const importLines = mainTs.split('\n').filter((l) => l.startsWith('import '));
    const importSet = new Set(importLines);
    expect(importLines.length).toEqual(importSet.size);
  });

  it('should have balanced braces in main.ts', () => {
    const mainTs = readFile(dir, 'src/main.ts');
    const opens = (mainTs.match(/\{/g) ?? []).length;
    const closes = (mainTs.match(/\}/g) ?? []).length;
    expect(opens).toEqual(closes);
  });

  it('should have balanced parentheses in main.ts', () => {
    const mainTs = readFile(dir, 'src/main.ts');
    const opens = (mainTs.match(/\(/g) ?? []).length;
    const closes = (mainTs.match(/\)/g) ?? []).length;
    expect(opens).toEqual(closes);
  });

  it('should have all recipe blocks properly delimited with start/end markers', () => {
    const mainTs = readFile(dir, 'src/main.ts');
    const startMarkers = mainTs.match(/\/\/ --- \w+ start ---/g) ?? [];
    const endMarkers = mainTs.match(/\/\/ --- \w+ end ---/g) ?? [];
    expect(startMarkers.length).toEqual(endMarkers.length);

    // Every start marker should have a matching end marker
    for (const start of startMarkers) {
      const blockId = start.replace('// --- ', '').replace(' start ---', '');
      expect(mainTs).toContain(`// --- ${blockId} end ---`);
    }
  });

  it('should include all expected dependencies in package.json', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;

    // Spot-check a few recipe-specific deps
    expect(deps['@nestjs/swagger']).toBeDefined();
    expect(deps['nestjs-pino']).toBeDefined();
    expect(deps['@nestjs/jwt']).toBeDefined();
    expect(deps['@nestjs/throttler']).toBeDefined();
    expect(deps['@sentry/nestjs']).toBeDefined();
    expect(deps['@opentelemetry/sdk-node']).toBeDefined();
    expect(deps['@nestjs/terminus']).toBeDefined();
  });

  it('should include all recipe env sections in .env.example', () => {
    const env = readFile(dir, '.env.example');

    // Recipes with env vars should have sections
    expect(env).toContain('# --- CORS ---');
    expect(env).toContain('# --- end CORS ---');
    expect(env).toContain('# --- Sentry ---');
    expect(env).toContain('# --- end Sentry ---');
    expect(env).toContain('# --- Pino Logger ---');
    expect(env).toContain('# --- end Pino Logger ---');
    expect(env).toContain('# --- JWT Authentication ---');
    expect(env).toContain('# --- end JWT Authentication ---');
    expect(env).toContain('# --- Rate Limiting ---');
    expect(env).toContain('# --- end Rate Limiting ---');
    expect(env).toContain('# --- OpenTelemetry ---');
    expect(env).toContain('# --- end OpenTelemetry ---');
  });

  it('should produce a valid .spoonfeed.json manifest with all 12 recipes', () => {
    const manifest = readJson(dir, '.spoonfeed.json');
    const recipes = manifest.recipes as Record<string, unknown>;
    expect(Object.keys(recipes).sort()).toEqual([...LARGE_RECIPE_SET].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Express vs Fastify ordering sensitivity
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe ordering: Express vs Fastify with reversed recipe order', () => {
  const orderA: RecipeId[] = ['swagger', 'helmet', 'cors', 'throttler', 'pino'];
  const orderB: RecipeId[] = ['pino', 'throttler', 'cors', 'helmet', 'swagger'];

  let expressA: string;
  let expressB: string;
  let fastifyA: string;
  let fastifyB: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    [expressA, expressB, fastifyA, fastifyB] = await Promise.all([
      generateProject(registry, { httpAdapter: 'express', recipes: [...orderA] }),
      generateProject(registry, { httpAdapter: 'express', recipes: [...orderB] }),
      generateProject(registry, { httpAdapter: 'fastify', recipes: [...orderA] }),
      generateProject(registry, { httpAdapter: 'fastify', recipes: [...orderB] }),
    ]);
  });

  afterAll(() => {
    fs.rmSync(expressA, { recursive: true, force: true });
    fs.rmSync(expressB, { recursive: true, force: true });
    fs.rmSync(fastifyA, { recursive: true, force: true });
    fs.rmSync(fastifyB, { recursive: true, force: true });
  });

  it('Express: package.json deps should be identical regardless of recipe order', () => {
    const pkgA = readJson(expressA, 'package.json');
    const pkgB = readJson(expressB, 'package.json');
    expect(pkgA.dependencies).toEqual(pkgB.dependencies);
    expect(pkgA.devDependencies).toEqual(pkgB.devDependencies);
  });

  it('Fastify: package.json deps should be identical regardless of recipe order', () => {
    const pkgA = readJson(fastifyA, 'package.json');
    const pkgB = readJson(fastifyB, 'package.json');
    expect(pkgA.dependencies).toEqual(pkgB.dependencies);
    expect(pkgA.devDependencies).toEqual(pkgB.devDependencies);
  });

  it('Express: both orderings should produce valid main.ts with all blocks', () => {
    const mainA = readFile(expressA, 'src/main.ts');
    const mainB = readFile(expressB, 'src/main.ts');

    for (const content of [mainA, mainB]) {
      expect(content).toContain('// --- swagger start ---');
      expect(content).toContain('// --- helmet start ---');

      // No duplicate imports
      const importLines = content.split('\n').filter((l) => l.startsWith('import '));
      expect(importLines.length).toEqual(new Set(importLines).size);
    }
  });

  it('Fastify: both orderings should produce valid main.ts with all blocks', () => {
    const mainA = readFile(fastifyA, 'src/main.ts');
    const mainB = readFile(fastifyB, 'src/main.ts');

    for (const content of [mainA, mainB]) {
      expect(content).toContain('// --- swagger start ---');
      expect(content).toContain('// --- helmet start ---');

      // No duplicate imports
      const importLines = content.split('\n').filter((l) => l.startsWith('import '));
      expect(importLines.length).toEqual(new Set(importLines).size);
    }
  });

  it('Express: should use express-specific helmet setup (app.use(helmet(...)))', () => {
    const mainA = readFile(expressA, 'src/main.ts');
    const mainB = readFile(expressB, 'src/main.ts');

    for (const content of [mainA, mainB]) {
      expect(content).toContain('app.use(');
      expect(content).toContain("from 'helmet'");
      expect(content).not.toContain("from '@fastify/helmet'");
    }
  });

  it('Fastify: should use fastify-specific helmet setup (app.register(helmet...))', () => {
    const mainA = readFile(fastifyA, 'src/main.ts');
    const mainB = readFile(fastifyB, 'src/main.ts');

    for (const content of [mainA, mainB]) {
      expect(content).toContain('app.register(helmet');
      expect(content).toContain("from '@fastify/helmet'");
      expect(content).not.toContain("from 'helmet'");
    }
  });

  it('Express: file set should be identical regardless of recipe order', () => {
    const filesA = collectFiles(expressA, expressA);
    const filesB = collectFiles(expressB, expressB);
    expect(filesA).toEqual(filesB);
  });

  it('Fastify: file set should be identical regardless of recipe order', () => {
    const filesA = collectFiles(fastifyA, fastifyA);
    const filesB = collectFiles(fastifyB, fastifyB);
    expect(filesA).toEqual(filesB);
  });

  it('Express: .env.example is identical regardless of recipe order', () => {
    const envA = readFile(expressA, '.env.example');
    const envB = readFile(expressB, '.env.example');

    // Sections are now sorted alphabetically, so env files should be identical
    expect(envA).toEqual(envB);
  });

  it('Fastify: .env.example is identical regardless of recipe order', () => {
    const envA = readFile(fastifyA, '.env.example');
    const envB = readFile(fastifyB, '.env.example');

    // Sections are now sorted alphabetically, so env files should be identical
    expect(envA).toEqual(envB);
  });

  // BUG: main.ts block order flips for Express adapter too, same as Fastify.
  it('Express: main.ts block order depends on recipe array order', () => {
    const mainA = readFile(expressA, 'src/main.ts');
    const mainB = readFile(expressB, 'src/main.ts');

    const swaggerIdxA = mainA.indexOf('// --- swagger start ---');
    const helmetIdxA = mainA.indexOf('// --- helmet start ---');
    const swaggerIdxB = mainB.indexOf('// --- swagger start ---');
    const helmetIdxB = mainB.indexOf('// --- helmet start ---');

    const swaggerFirstA = swaggerIdxA < helmetIdxA;
    const swaggerFirstB = swaggerIdxB < helmetIdxB;

    // BUG: Block insertion order changes with recipe array order, same as Fastify.
    expect(swaggerFirstA).not.toEqual(swaggerFirstB);
  });

  it('both adapters should produce structurally equivalent manifests regardless of order', () => {
    const manifestExA = normalizeManifest(readJson(expressA, '.spoonfeed.json'));
    const manifestExB = normalizeManifest(readJson(expressB, '.spoonfeed.json'));
    const manifestFyA = normalizeManifest(readJson(fastifyA, '.spoonfeed.json'));
    const manifestFyB = normalizeManifest(readJson(fastifyB, '.spoonfeed.json'));

    // Same adapter, different order: should have same recipe keys
    expect(Object.keys((manifestExA.recipes as Record<string, unknown>)).sort())
      .toEqual(Object.keys((manifestExB.recipes as Record<string, unknown>)).sort());
    expect(Object.keys((manifestFyA.recipes as Record<string, unknown>)).sort())
      .toEqual(Object.keys((manifestFyB.recipes as Record<string, unknown>)).sort());
  });
});
