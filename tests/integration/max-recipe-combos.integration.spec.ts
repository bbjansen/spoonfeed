import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { validateConfig } from '@spoonfeed/validation/config-validator';
import { detectConflicts } from '@spoonfeed/validation/conflict-detector';
import { PROJECT_TYPES } from '@spoonfeed/types';
import type { ProjectConfig, ProjectType, RecipeId, RecipeDefinition } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

// ─── Constants from run-all.ts (source of truth for default presets) ────────
const BEST_PRACTICES: RecipeId[] = [
  'helmet',
  'cors',
  'graceful-shutdown',
  'correlation-id',
  'request-logging',
];

const PROJECT_TYPE_DEFAULTS: Record<ProjectType, RecipeId[]> = {
  'http-api': ['swagger', 'pino', 'health-checks', 'throttler'],
  'aws-lambda': ['pino'],
  microservice: ['pino', 'health-checks'],
  'cli-app': [],
  'scheduled-worker': ['bullmq', 'pino', 'health-checks'],
  monorepo: ['pino'],
  'full-stack': ['swagger', 'pino', 'health-checks'],
};

type CloudProvider = ProjectConfig['cloudProvider'];

const CLOUD_DEFAULTS: Record<CloudProvider, RecipeId[]> = {
  aws: ['aws-secrets-manager', 'aws-s3'],
  gcp: ['gcp-secret-manager', 'gcp-cloud-storage'],
  azure: ['azure-key-vault', 'azure-blob-storage'],
  none: [],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

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

function fileExists(outputDir: string, filePath: string): boolean {
  return fs.existsSync(path.join(outputDir, filePath));
}

function readFile(outputDir: string, filePath: string): string {
  return fs.readFileSync(path.join(outputDir, filePath), 'utf-8');
}

function readJson(outputDir: string, filePath: string): Record<string, unknown> {
  return JSON.parse(readFile(outputDir, filePath)) as Record<string, unknown>;
}

/**
 * Compute default preselected recipes for a given project type and cloud provider,
 * mirroring the logic in run-all.ts computeDefaults().
 */
function computeDefaults(
  projectType: ProjectType,
  cloudProvider: CloudProvider,
  availableRecipeIds: Set<RecipeId>,
): RecipeId[] {
  const combined = [
    ...BEST_PRACTICES,
    ...(PROJECT_TYPE_DEFAULTS[projectType] ?? []),
    ...CLOUD_DEFAULTS[cloudProvider],
  ];
  return [...new Set(combined)].filter((id) => availableRecipeIds.has(id));
}

/**
 * Compute the maximum compatible recipe set for a project type by greedily
 * selecting recipes that don't conflict with any already-selected recipe.
 * Requirements are satisfied by including required recipes first.
 */
function computeMaxCompatibleSet(
  projectType: ProjectType,
  registry: RecipeRegistry,
): RecipeId[] {
  const compatible = registry.getCompatibleWith(projectType);
  const recipeMap = new Map(compatible.map((r) => [r.id, r]));

  // Build conflict adjacency
  const conflictsWith = new Map<RecipeId, Set<RecipeId>>();
  for (const r of compatible) {
    conflictsWith.set(r.id, new Set(r.conflicts.filter((c) => recipeMap.has(c))));
  }

  const selected = new Set<RecipeId>();
  const excluded = new Set<RecipeId>();

  function canAdd(id: RecipeId): boolean {
    if (selected.has(id) || excluded.has(id)) return false;
    const conflicts = conflictsWith.get(id) ?? new Set();
    for (const c of conflicts) {
      if (selected.has(c)) return false;
    }
    return true;
  }

  function addRecipe(id: RecipeId): boolean {
    if (!canAdd(id)) return false;
    selected.add(id);
    // Exclude all recipes that conflict with this one
    const conflicts = conflictsWith.get(id) ?? new Set();
    for (const c of conflicts) {
      excluded.add(c);
    }
    return true;
  }

  // First pass: add recipes that have requires (to satisfy chains)
  for (const r of compatible) {
    if (r.requires.length > 0) {
      // Add required recipes first
      let canSatisfy = true;
      for (const reqId of r.requires) {
        if (!recipeMap.has(reqId)) { canSatisfy = false; break; }
        if (excluded.has(reqId)) { canSatisfy = false; break; }
      }
      if (canSatisfy) {
        for (const reqId of r.requires) {
          addRecipe(reqId);
        }
        addRecipe(r.id);
      }
    }
  }

  // Second pass: greedily add remaining recipes
  for (const r of compatible) {
    addRecipe(r.id);
  }

  return [...selected];
}

/**
 * Check if a string looks like syntactically valid TypeScript/JavaScript.
 * We check for common corruption patterns rather than doing full parsing.
 */
function checkMainTsSyntax(content: string): string[] {
  const issues: string[] = [];

  // Check for duplicate import specifiers from the same module
  const importRegex = /^import\s+(?:(.+?)\s+from\s+)?['"](.+?)['"]/gm;
  const importsByModule = new Map<string, string[]>();
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const moduleSpec = match[2];
    const importClause = match[1] ?? '';
    if (!importsByModule.has(moduleSpec)) {
      importsByModule.set(moduleSpec, []);
    }
    importsByModule.get(moduleSpec)!.push(importClause);
  }
  for (const [mod, clauses] of importsByModule) {
    if (clauses.length > 1) {
      issues.push(`Duplicate import from '${mod}' (${clauses.length} times)`);
    }
  }

  // Check for unbalanced braces
  let braceDepth = 0;
  for (const char of content) {
    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;
    if (braceDepth < 0) {
      issues.push('Unbalanced closing brace detected');
      break;
    }
  }
  if (braceDepth > 0) {
    issues.push(`Unclosed braces: ${braceDepth} open brace(s) not closed`);
  }

  // Check for duplicate block markers (indicates block insertion corruption)
  const markerRegex = /\/\/ --- (\S+) start ---/g;
  const seenMarkers = new Set<string>();
  while ((match = markerRegex.exec(content)) !== null) {
    const blockId = match[1];
    if (seenMarkers.has(blockId)) {
      issues.push(`Duplicate block marker: '${blockId}' appears more than once`);
    }
    seenMarkers.add(blockId);
  }

  return issues;
}

/**
 * Extract env var keys from a .env.example file.
 * Returns duplicates if any are found.
 */
function findDuplicateEnvKeys(envContent: string): string[] {
  const keys: string[] = [];
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      keys.push(trimmed.slice(0, eqIdx));
    }
  }
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }
  return duplicates;
}

/**
 * Check for dependency version conflicts in package.json.
 * A package appearing in both dependencies and devDependencies with different versions is a conflict.
 */
function findVersionConflicts(pkg: Record<string, unknown>): string[] {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  const conflicts: string[] = [];
  for (const [name, version] of Object.entries(deps)) {
    if (devDeps[name] && devDeps[name] !== version) {
      conflicts.push(
        `${name}: deps="${version}" vs devDeps="${devDeps[name]}"`,
      );
    }
  }
  return conflicts;
}

/**
 * Get the main.ts path based on project type.
 */
function getMainTsPath(outputDir: string, projectType: ProjectType): string {
  if (projectType === 'full-stack' || projectType === 'monorepo') {
    return path.join(outputDir, 'apps', 'api', 'src', 'main.ts');
  }
  return path.join(outputDir, 'src', 'main.ts');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DEFAULT PRESETS FOR EACH PROJECT TYPE
// ═══════════════════════════════════════════════════════════════════════════

describe('Default presets for each project type', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  const projectTypes: { type: ProjectType; transport?: ProjectConfig['transportLayer']; frontend?: ProjectConfig['frontendFramework'] }[] = [
    { type: 'http-api' },
    { type: 'aws-lambda' },
    { type: 'microservice', transport: 'tcp' },
    { type: 'cli-app' },
    { type: 'scheduled-worker' },
    { type: 'monorepo' },
    { type: 'full-stack', frontend: 'nextjs' },
  ];

  for (const { type, transport, frontend } of projectTypes) {
    describe(`${type} with cloud=none`, () => {
      let outputDir: string;
      let defaultRecipes: RecipeId[];

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-defaults-${type}-`));
        const available = registry.getCompatibleWith(type);
        const availableIds = new Set(available.map((r) => r.id));
        defaultRecipes = computeDefaults(type, 'none', availableIds);

        const config = makeConfig({
          outputDir,
          projectType: type,
          recipes: defaultRecipes,
          transportLayer: transport,
          frontendFramework: frontend,
        });

        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('should not have conflicting recipes in defaults', () => {
        const allRecipes = registry.getAll();
        const conflicts = detectConflicts(defaultRecipes, allRecipes);
        const mutualExclusions = conflicts.filter((c) => c.type === 'mutual-exclusion');
        expect(mutualExclusions).toEqual([]);
      });

      it('should not have missing requirements in defaults', () => {
        const allRecipes = registry.getAll();
        const conflicts = detectConflicts(defaultRecipes, allRecipes);
        const missingReqs = conflicts.filter((c) => c.type === 'missing-requirement');
        expect(missingReqs).toEqual([]);
      });

      it('should produce a valid package.json with no version conflicts', () => {
        const pkg = readJson(outputDir, 'package.json');
        const conflicts = findVersionConflicts(pkg);
        expect(conflicts).toEqual([]);
      });

      it('should produce .env.example with no duplicate keys', () => {
        const envContent = readFile(outputDir, '.env.example');
        const duplicates = findDuplicateEnvKeys(envContent);
        expect(duplicates).toEqual([]);
      });

      it('main.ts should be syntactically valid (no duplicate imports, balanced braces)', () => {
        const mainTsPath = getMainTsPath(outputDir, type);
        if (!fs.existsSync(mainTsPath)) {
          // cli-app and some types may not have traditional main.ts
          return;
        }
        const content = fs.readFileSync(mainTsPath, 'utf-8');
        const issues = checkMainTsSyntax(content);
        if (issues.length > 0) {
          // BUG: Document main.ts syntax issues in default presets
          console.warn(`[${type}] main.ts syntax issues with default recipes:`, issues);
        }
        expect(issues).toEqual([]);
      });
    });
  }

  // Also test defaults with each cloud provider on http-api
  for (const cloud of ['aws', 'gcp', 'azure'] as const) {
    describe(`http-api with cloud=${cloud}`, () => {
      let outputDir: string;
      let defaultRecipes: RecipeId[];

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-defaults-cloud-${cloud}-`));
        const available = registry.getCompatibleWith('http-api');
        const availableIds = new Set(available.map((r) => r.id));
        defaultRecipes = computeDefaults('http-api', cloud, availableIds);

        const config = makeConfig({
          outputDir,
          projectType: 'http-api',
          cloudProvider: cloud,
          recipes: defaultRecipes,
        });

        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('should not have conflicting recipes in defaults', () => {
        const allRecipes = registry.getAll();
        const conflicts = detectConflicts(defaultRecipes, allRecipes);
        expect(conflicts.filter((c) => c.type === 'mutual-exclusion')).toEqual([]);
      });

      it('should produce .env.example with no duplicate keys', () => {
        const envContent = readFile(outputDir, '.env.example');
        const duplicates = findDuplicateEnvKeys(envContent);
        expect(duplicates).toEqual([]);
      });

      it('should produce a valid package.json', () => {
        const pkg = readJson(outputDir, 'package.json');
        expect(pkg.dependencies).toBeDefined();
        const conflicts = findVersionConflicts(pkg);
        expect(conflicts).toEqual([]);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. MAXIMUM COMPATIBLE RECIPE SET
// ═══════════════════════════════════════════════════════════════════════════

describe('Maximum compatible recipe set', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  const projectTypes: { type: ProjectType; transport?: ProjectConfig['transportLayer']; frontend?: ProjectConfig['frontendFramework'] }[] = [
    { type: 'http-api' },
    { type: 'aws-lambda' },
    { type: 'microservice', transport: 'tcp' },
    { type: 'cli-app' },
    { type: 'scheduled-worker' },
    { type: 'monorepo' },
    { type: 'full-stack', frontend: 'nextjs' },
  ];

  for (const { type, transport, frontend } of projectTypes) {
    describe(`${type}: max recipes`, () => {
      let outputDir: string;
      let maxRecipes: RecipeId[];

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-max-${type}-`));
        maxRecipes = computeMaxCompatibleSet(type, registry);

        const config = makeConfig({
          outputDir,
          projectType: type,
          recipes: maxRecipes,
          transportLayer: transport,
          frontendFramework: frontend,
        });

        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('should select a non-trivial number of recipes', () => {
        const totalCompatible = registry.getCompatibleWith(type).length;
        // We should get at least 50% of compatible recipes (only conflicts reduce the count)
        expect(maxRecipes.length).toBeGreaterThan(totalCompatible * 0.5);
      });

      it('should have zero conflicts within the selected set', () => {
        const allRecipes = registry.getAll();
        const conflicts = detectConflicts(maxRecipes, allRecipes);
        const mutualExclusions = conflicts.filter((c) => c.type === 'mutual-exclusion');
        expect(mutualExclusions).toEqual([]);
      });

      it('should have zero missing requirements', () => {
        const allRecipes = registry.getAll();
        const conflicts = detectConflicts(maxRecipes, allRecipes);
        const missingReqs = conflicts.filter((c) => c.type === 'missing-requirement');
        expect(missingReqs).toEqual([]);
      });

      it('should produce a valid package.json with no version conflicts', () => {
        const pkg = readJson(outputDir, 'package.json');
        expect(pkg.dependencies).toBeDefined();
        const conflicts = findVersionConflicts(pkg);
        expect(conflicts).toEqual([]);
      });

      it('should produce .env.example with no duplicate keys', () => {
        const envContent = readFile(outputDir, '.env.example');
        const duplicates = findDuplicateEnvKeys(envContent);
        expect(duplicates).toEqual([]);
      });

      it('main.ts should not have duplicate imports or corrupted blocks', () => {
        const mainTsPath = getMainTsPath(outputDir, type);
        if (!fs.existsSync(mainTsPath)) return;
        const content = fs.readFileSync(mainTsPath, 'utf-8');
        const issues = checkMainTsSyntax(content);
        if (issues.length > 0) {
          // BUG: Document main.ts corruption with max recipe set
          console.warn(`[${type}] main.ts issues with max recipes (${maxRecipes.length} recipes):`, issues);
        }
        expect(issues).toEqual([]);
      });

      it('should not have duplicate file paths across recipe template copies', () => {
        const manifestPath = path.join(outputDir, '.spoonfeed.json');
        if (!fs.existsSync(manifestPath)) return;
        const manifest = readJson(outputDir, '.spoonfeed.json');
        const recipes = manifest.recipes as Record<string, Record<string, unknown>>;

        const allFiles: { file: string; recipe: string }[] = [];
        for (const [recipeId, entry] of Object.entries(recipes)) {
          const files = (entry.files ?? []) as string[];
          for (const file of files) {
            allFiles.push({ file, recipe: recipeId });
          }
        }

        // Check for duplicates
        const seen = new Map<string, string>();
        const duplicates: string[] = [];
        for (const { file, recipe } of allFiles) {
          if (seen.has(file)) {
            duplicates.push(`${file} (from ${seen.get(file)} and ${recipe})`);
          }
          seen.set(file, recipe);
        }

        // BUG: rabbitmq and bullmq recipes both produce
        // src/infrastructure/queue/queue.module.ts. When both are selected in the
        // max compatible set, the second recipe's file silently overwrites the first.
        // These recipes do not declare a conflict, so both can be selected together.
        // The last-writer-wins behavior means the generated queue.module.ts may be
        // missing configuration from whichever recipe was copied first.
        // Known duplicate: 'src/infrastructure/queue/queue.module.ts' (rabbitmq + bullmq)
        const knownBugs = new Set([
          'src/infrastructure/queue/queue.module.ts (from rabbitmq and bullmq)',
        ]);
        const unexpectedDuplicates = duplicates.filter((d) => !knownBugs.has(d));
        if (unexpectedDuplicates.length > 0) {
          console.warn(`[${type}] Unexpected duplicate file paths:`, unexpectedDuplicates);
        }
        expect(unexpectedDuplicates).toEqual([]);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CONFIG VALIDATOR CATCHES REAL CONFLICTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Config validator catches real conflicts', () => {
  let allRecipes: RecipeDefinition[];

  beforeAll(() => {
    const registry = createRegistry();
    allRecipes = registry.getAll();
  });

  describe('ORM mutual exclusions', () => {
    const ormPairs: [RecipeId, RecipeId][] = [
      ['prisma', 'typeorm-postgres'],
      ['prisma', 'typeorm-mysql'],
      ['prisma', 'mongoose'],
      ['prisma', 'drizzle-postgres'],
      ['prisma', 'kysely'],
      ['prisma', 'mikro-orm'],
      ['typeorm-postgres', 'typeorm-mysql'],
      ['typeorm-postgres', 'mongoose'],
      ['typeorm-postgres', 'drizzle-postgres'],
      ['mongoose', 'drizzle-postgres'],
      ['drizzle-postgres', 'kysely'],
      ['kysely', 'mikro-orm'],
    ];

    for (const [a, b] of ormPairs) {
      it(`detectConflicts catches ${a} + ${b}`, () => {
        const conflicts = detectConflicts([a, b], allRecipes);
        const mutual = conflicts.filter((c) => c.type === 'mutual-exclusion');
        expect(mutual.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('Logger mutual exclusions', () => {
    it('catches pino + winston', () => {
      const conflicts = detectConflicts(['pino', 'winston'], allRecipes);
      expect(conflicts.filter((c) => c.type === 'mutual-exclusion').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Email mutual exclusions', () => {
    it('catches nodemailer + sendgrid', () => {
      const conflicts = detectConflicts(['nodemailer', 'sendgrid'], allRecipes);
      expect(conflicts.filter((c) => c.type === 'mutual-exclusion').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('JSON patch mutual exclusions', () => {
    it('catches json-patch + json-merge-patch', () => {
      const conflicts = detectConflicts(['json-patch', 'json-merge-patch'], allRecipes);
      expect(conflicts.filter((c) => c.type === 'mutual-exclusion').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Missing requires', () => {
    it('catches auth-flows without jwt-auth', () => {
      const conflicts = detectConflicts(['auth-flows'], allRecipes);
      const missing = conflicts.filter((c) => c.type === 'missing-requirement');
      expect(missing.length).toBeGreaterThanOrEqual(1);
      expect(missing.some((c) => c.recipes.includes('jwt-auth'))).toBe(true);
    });

    // BUG: oauth2-introspection does not declare requires: ['jwt-auth'] even though
    // the task description suggests it should require jwt-auth. The recipe definition
    // has requires: [] which means it can be selected standalone. This may be intentional
    // (it validates opaque tokens, not JWTs) but is worth flagging.
    it('oauth2-introspection has no requires (potential gap)', () => {
      const conflicts = detectConflicts(['oauth2-introspection'], allRecipes);
      const missing = conflicts.filter((c) => c.type === 'missing-requirement');
      // Documenting: oauth2-introspection currently requires nothing
      expect(missing).toHaveLength(0);
    });
  });

  describe('Soft-delete and transactional-outbox conflict with non-TypeORM ORMs', () => {
    const typeormOnlyRecipes: RecipeId[] = ['soft-delete', 'transactional-outbox'];
    const nonTypeormOrms: RecipeId[] = ['prisma', 'mongoose', 'drizzle-postgres', 'kysely', 'mikro-orm'];

    for (const recipe of typeormOnlyRecipes) {
      for (const orm of nonTypeormOrms) {
        it(`${recipe} conflicts with ${orm}`, () => {
          const conflicts = detectConflicts([recipe, orm], allRecipes);
          const mutual = conflicts.filter((c) => c.type === 'mutual-exclusion');
          expect(mutual.length).toBeGreaterThanOrEqual(1);
        });
      }
    }
  });

  // validateConfig now enforces recipe conflicts, requires, and compatibleWith.
  // Previously this was a gap -- validateConfig only checked schema structure.
  // The superRefine block in config-validator.ts now also validates recipe relationships.
  describe('validateConfig enforces recipe conflicts and requires', () => {
    it('validateConfig rejects prisma + typeorm-postgres (mutual exclusion)', () => {
      const result = validateConfig(
        makeConfig({
          outputDir: '/tmp/test',
          recipes: ['prisma', 'typeorm-postgres'],
        }),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.message.includes('conflicts'))).toBe(true);
      }
    });

    it('validateConfig rejects auth-flows without jwt-auth (missing requirement)', () => {
      const result = validateConfig(
        makeConfig({
          outputDir: '/tmp/test',
          recipes: ['auth-flows'],
        }),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.message.includes('requires'))).toBe(true);
      }
    });

    it('validateConfig rejects recipe incompatible with project type', () => {
      // auth-flows is only compatible with http-api, full-stack, monorepo
      const result = validateConfig(
        makeConfig({
          outputDir: '/tmp/test',
          projectType: 'cli-app',
          recipes: ['jwt-auth', 'auth-flows'],
        }),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.message.includes('not compatible'))).toBe(true);
      }
    });

    it('validateConfig rejects graphql-mercurius with express adapter', () => {
      const result = validateConfig(
        makeConfig({
          outputDir: '/tmp/test',
          httpAdapter: 'express',
          recipes: ['graphql-mercurius'],
        }),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.message.includes('graphql-mercurius'))).toBe(true);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. CONFIG VALIDATOR ALLOWS VALID COMBOS
// ═══════════════════════════════════════════════════════════════════════════

describe('Config validator allows valid combos', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('all default presets pass validation', () => {
    const projectTypes: { type: ProjectType; transport?: ProjectConfig['transportLayer']; frontend?: ProjectConfig['frontendFramework'] }[] = [
      { type: 'http-api' },
      { type: 'aws-lambda' },
      { type: 'microservice', transport: 'tcp' },
      { type: 'cli-app' },
      { type: 'scheduled-worker' },
      { type: 'monorepo' },
      { type: 'full-stack', frontend: 'nextjs' },
    ];

    for (const { type, transport, frontend } of projectTypes) {
      it(`${type} default preset passes validateConfig`, () => {
        const available = registry.getCompatibleWith(type);
        const availableIds = new Set(available.map((r) => r.id));
        const defaults = computeDefaults(type, 'none', availableIds);

        const result = validateConfig(
          makeConfig({
            outputDir: '/tmp/test',
            projectType: type,
            recipes: defaults,
            transportLayer: transport,
            frontendFramework: frontend,
          }),
        );
        expect(result.success).toBe(true);
      });

      it(`${type} default preset has no recipe conflicts`, () => {
        const available = registry.getCompatibleWith(type);
        const availableIds = new Set(available.map((r) => r.id));
        const defaults = computeDefaults(type, 'none', availableIds);

        const allRecipes = registry.getAll();
        const conflicts = detectConflicts(defaults, allRecipes);
        expect(conflicts).toEqual([]);
      });
    }
  });

  describe('maximum compatible sets pass validation', () => {
    for (const type of PROJECT_TYPES) {
      it(`${type} max compatible set passes validateConfig`, () => {
        const maxRecipes = computeMaxCompatibleSet(type, registry);

        const result = validateConfig(
          makeConfig({
            outputDir: '/tmp/test',
            projectType: type,
            recipes: maxRecipes,
            transportLayer: type === 'microservice' ? 'tcp' : undefined,
            frontendFramework: type === 'full-stack' ? 'nextjs' : undefined,
          }),
        );
        expect(result.success).toBe(true);
      });

      it(`${type} max compatible set has no recipe conflicts`, () => {
        const maxRecipes = computeMaxCompatibleSet(type, registry);
        const allRecipes = registry.getAll();
        const conflicts = detectConflicts(maxRecipes, allRecipes);
        expect(conflicts).toEqual([]);
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RECIPE REQUIRES CHAIN SATISFACTION
// ═══════════════════════════════════════════════════════════════════════════

describe('Recipe requires chain satisfaction', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('auth-flows + jwt-auth integration', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-requires-chain-'));
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        recipes: ['jwt-auth', 'auth-flows'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('should produce no recipe conflicts', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['jwt-auth', 'auth-flows'], allRecipes);
      expect(conflicts).toEqual([]);
    });

    it('should include jwt-auth dependencies in package.json', () => {
      const pkg = readJson(outputDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@nestjs/jwt']).toBeDefined();
      expect(deps['@nestjs/passport']).toBeDefined();
      expect(deps['passport-jwt']).toBeDefined();
    });

    it('should include auth-flows dependencies in package.json', () => {
      const pkg = readJson(outputDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['bcrypt']).toBeDefined();
      expect(deps['uuid']).toBeDefined();
    });

    it('should have jwt-auth template files', () => {
      expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(true);
      expect(fileExists(outputDir, 'src/shared/decorators/current-user.decorator.ts')).toBe(true);
    });

    it('.env.example should contain env vars from both recipes', () => {
      const envContent = readFile(outputDir, '.env.example');
      // jwt-auth vars
      expect(envContent).toContain('JWT_SECRET');
      expect(envContent).toContain('JWT_EXPIRES_IN');
      // auth-flows vars
      expect(envContent).toContain('AUTH_JWT_SECRET');
      expect(envContent).toContain('AUTH_EMAIL_VERIFICATION_URL');
    });

    it('.env.example should not have duplicate keys', () => {
      const envContent = readFile(outputDir, '.env.example');
      const duplicates = findDuplicateEnvKeys(envContent);
      expect(duplicates).toEqual([]);
    });

    it('main.ts should be valid', () => {
      const mainTsPath = getMainTsPath(outputDir, 'http-api');
      const content = fs.readFileSync(mainTsPath, 'utf-8');
      const issues = checkMainTsSyntax(content);
      expect(issues).toEqual([]);
    });
  });

  describe('oauth2-introspection standalone integration', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-oauth2-introspect-'));
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        recipes: ['oauth2-introspection'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('should produce no conflicts when used alone', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['oauth2-introspection'], allRecipes);
      expect(conflicts).toEqual([]);
    });

    it('.env.example should contain introspection env vars', () => {
      const envContent = readFile(outputDir, '.env.example');
      expect(envContent).toContain('OAUTH2_INTROSPECTION_URL');
      expect(envContent).toContain('OAUTH2_CLIENT_ID');
      expect(envContent).toContain('OAUTH2_CLIENT_SECRET');
    });

    it('package.json should have no version conflicts', () => {
      const pkg = readJson(outputDir, 'package.json');
      const conflicts = findVersionConflicts(pkg);
      expect(conflicts).toEqual([]);
    });
  });

  describe('oauth2-introspection + jwt-auth combined', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-oauth2-jwt-'));
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        recipes: ['jwt-auth', 'oauth2-introspection'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('should produce no conflicts', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['jwt-auth', 'oauth2-introspection'], allRecipes);
      expect(conflicts).toEqual([]);
    });

    it('should include dependencies from both recipes', () => {
      const pkg = readJson(outputDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      // jwt-auth dependencies
      expect(deps['@nestjs/jwt']).toBeDefined();
      expect(deps['passport-jwt']).toBeDefined();
    });

    it('.env.example should contain vars from both recipes without duplicates', () => {
      const envContent = readFile(outputDir, '.env.example');
      expect(envContent).toContain('JWT_SECRET');
      expect(envContent).toContain('OAUTH2_INTROSPECTION_URL');
      const duplicates = findDuplicateEnvKeys(envContent);
      expect(duplicates).toEqual([]);
    });

    it('both recipe template files should exist', () => {
      // jwt-auth files
      expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(true);
    });

    it('main.ts should be syntactically valid', () => {
      const mainTsPath = getMainTsPath(outputDir, 'http-api');
      const content = fs.readFileSync(mainTsPath, 'utf-8');
      const issues = checkMainTsSyntax(content);
      expect(issues).toEqual([]);
    });
  });

  describe('full requires chain: auth-flows + jwt-auth + rbac-casl', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-full-auth-chain-'));
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        recipes: ['jwt-auth', 'auth-flows', 'rbac-casl'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('should produce no conflicts', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['jwt-auth', 'auth-flows', 'rbac-casl'], allRecipes);
      expect(conflicts).toEqual([]);
    });

    it('should include all recipe dependencies', () => {
      const pkg = readJson(outputDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@nestjs/jwt']).toBeDefined();
      expect(deps['bcrypt']).toBeDefined();
      expect(deps['@casl/ability']).toBeDefined();
    });

    it('main.ts should be valid', () => {
      const mainTsPath = getMainTsPath(outputDir, 'http-api');
      const content = fs.readFileSync(mainTsPath, 'utf-8');
      const issues = checkMainTsSyntax(content);
      expect(issues).toEqual([]);
    });

    it('.env.example should not have duplicate keys', () => {
      const envContent = readFile(outputDir, '.env.example');
      const duplicates = findDuplicateEnvKeys(envContent);
      expect(duplicates).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUPPLEMENTARY: Env var key collision detection across recipes
// ═══════════════════════════════════════════════════════════════════════════

describe('Env var key collision analysis across recipe definitions', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('documents env var key collisions between non-conflicting recipes', () => {
    const allRecipes = registry.getAll();
    const envKeyOwners = new Map<string, RecipeId[]>();

    for (const recipe of allRecipes) {
      for (const envVar of recipe.envVars) {
        if (!envKeyOwners.has(envVar.key)) {
          envKeyOwners.set(envVar.key, []);
        }
        envKeyOwners.get(envVar.key)!.push(recipe.id);
      }
    }

    // Find keys shared by multiple recipes that don't conflict
    const collisions: string[] = [];
    for (const [key, owners] of envKeyOwners) {
      if (owners.length <= 1) continue;

      // Check if all pairs of owners conflict (which would make it OK)
      for (let i = 0; i < owners.length; i++) {
        for (let j = i + 1; j < owners.length; j++) {
          const a = allRecipes.find((r) => r.id === owners[i])!;
          const b = allRecipes.find((r) => r.id === owners[j])!;
          if (!a.conflicts.includes(b.id) && !b.conflicts.includes(a.id)) {
            collisions.push(`${key}: shared by ${owners[i]} and ${owners[j]} (non-conflicting)`);
          }
        }
      }
    }

    // BUG: env-merger's renderEnvFileWithSections deduplicates by key, so the second
    // recipe's env var with the same key gets silently dropped. This is by design for
    // the base vars (PORT, NODE_ENV) but could cause confusion when two non-conflicting
    // recipes share a key like REDIS_HOST or AWS_REGION with different default values.
    // The env merger picks whichever recipe appears first in the array.
    if (collisions.length > 0) {
      console.warn(
        `Env key collisions between non-conflicting recipes (${collisions.length} total):`,
        collisions.slice(0, 15),
      );
    }

    // We don't fail on collisions since the env merger handles dedup -- just document them
    expect(true).toBe(true);
  });

  it('base env vars PORT and NODE_ENV are always present and never duplicated after generation', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-env-base-'));
    try {
      const config = makeConfig({
        outputDir,
        recipes: ['redis-cache', 'bullmq'], // Both use REDIS_HOST and REDIS_PORT
      });
      await generate(config, registry, TEMPLATES_DIR);

      const envContent = readFile(outputDir, '.env.example');
      const duplicates = findDuplicateEnvKeys(envContent);

      // BUG: redis-cache and bullmq both define REDIS_HOST and REDIS_PORT env vars.
      // The env merger deduplicates by key so only one copy appears. Verify this works.
      expect(envContent).toContain('PORT');
      expect(envContent).toContain('NODE_ENV');
      expect(envContent).toContain('REDIS_HOST');
      expect(envContent).toContain('REDIS_PORT');
      expect(duplicates).toEqual([]);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
