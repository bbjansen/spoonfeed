import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { generate } from '@spoonfeed/generator/generator';
import { validateConfig } from '@spoonfeed/validation/config-validator';
import { PROJECT_TYPES, CLOUD_PROVIDERS, HTTP_ADAPTERS } from '@spoonfeed/types';
import type {
  ProjectConfig,
  ProjectType,
  CloudProvider,
  HttpAdapter,
  RecipeId,
  RecipeDefinition,
} from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

// ─── Mirrors from src/prompts/run-all.ts ──────────────────────────────────

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

const CLOUD_DEFAULTS: Record<CloudProvider, RecipeId[]> = {
  aws: ['aws-secrets-manager', 'aws-s3'],
  gcp: ['gcp-secret-manager', 'gcp-cloud-storage'],
  azure: ['azure-key-vault', 'azure-blob-storage'],
  none: [],
};

const HTTP_PROJECT_TYPES = new Set<ProjectType>([
  'http-api',
  'aws-lambda',
  'full-stack',
  'monorepo',
]);

const NON_HTTP_PROJECT_TYPES: ProjectType[] = ['cli-app', 'scheduled-worker', 'microservice'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

function computeDefaults(
  registry: RecipeRegistry,
  projectType: ProjectType,
  cloudProvider: CloudProvider,
): RecipeId[] {
  const availableRecipes = registry.getCompatibleWith(projectType);
  const availableIds = new Set(availableRecipes.map((r) => r.id));
  const combined = [
    ...BEST_PRACTICES,
    ...(PROJECT_TYPE_DEFAULTS[projectType] ?? []),
    ...CLOUD_DEFAULTS[cloudProvider],
  ];
  return [...new Set(combined)].filter((id) => availableIds.has(id));
}

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'preset-test',
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

function fileExists(outputDir: string, filePath: string): boolean {
  return fs.existsSync(path.join(outputDir, filePath));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Extract and validate all default recipe presets
// ─────────────────────────────────────────────────────────────────────────────

describe('Default recipe preset extraction and validation', () => {
  let registry: RecipeRegistry;
  let allRecipes: RecipeDefinition[];

  beforeAll(() => {
    registry = createRegistry();
    allRecipes = registry.getAll();
  });

  it('BEST_PRACTICES recipes all exist in the registry', () => {
    for (const id of BEST_PRACTICES) {
      expect(registry.get(id)).toBeDefined();
    }
  });

  it('PROJECT_TYPE_DEFAULTS recipes all exist in the registry', () => {
    for (const [projectType, recipeIds] of Object.entries(PROJECT_TYPE_DEFAULTS)) {
      for (const id of recipeIds) {
        const recipe = registry.get(id);
        expect(recipe).toBeDefined();
      }
    }
  });

  it('CLOUD_DEFAULTS recipes all exist in the registry', () => {
    for (const [provider, recipeIds] of Object.entries(CLOUD_DEFAULTS)) {
      for (const id of recipeIds) {
        expect(registry.get(id)).toBeDefined();
      }
    }
  });

  it('PROJECT_TYPE_DEFAULTS covers every project type', () => {
    for (const pt of PROJECT_TYPES) {
      expect(PROJECT_TYPE_DEFAULTS).toHaveProperty(pt);
    }
  });

  it('CLOUD_DEFAULTS covers every cloud provider', () => {
    for (const cp of CLOUD_PROVIDERS) {
      expect(CLOUD_DEFAULTS).toHaveProperty(cp);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Validate each preset combo: no conflicts, no incompatible recipes,
//    no missing requires, validateConfig accepts the combo
// ─────────────────────────────────────────────────────────────────────────────

describe('Default preset combos pass validation', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  const combos: Array<{
    projectType: ProjectType;
    cloudProvider: CloudProvider;
    httpAdapter: HttpAdapter;
  }> = [];

  for (const pt of PROJECT_TYPES) {
    for (const cp of CLOUD_PROVIDERS) {
      for (const ha of HTTP_ADAPTERS) {
        combos.push({ projectType: pt, cloudProvider: cp, httpAdapter: ha });
      }
    }
  }

  describe('no conflicts between default recipes', () => {
    it.each(combos.map((c) => [
      `${c.projectType} / ${c.cloudProvider} / ${c.httpAdapter}`,
      c,
    ]))(
      '%s',
      (_label, combo) => {
        const { projectType, cloudProvider, httpAdapter } = combo as {
          projectType: ProjectType;
          cloudProvider: CloudProvider;
          httpAdapter: HttpAdapter;
        };
        const defaults = computeDefaults(registry, projectType, cloudProvider);
        const violations: string[] = [];

        for (const id of defaults) {
          const def = registry.get(id)!;
          for (const conflictId of def.conflicts) {
            if (defaults.includes(conflictId as RecipeId)) {
              violations.push(`${id} conflicts with ${conflictId}`);
            }
          }
        }

        expect(violations).toEqual([]);
      },
    );
  });

  describe('no missing requires in default recipes', () => {
    it.each(combos.map((c) => [
      `${c.projectType} / ${c.cloudProvider} / ${c.httpAdapter}`,
      c,
    ]))(
      '%s',
      (_label, combo) => {
        const { projectType, cloudProvider } = combo as {
          projectType: ProjectType;
          cloudProvider: CloudProvider;
        };
        const defaults = computeDefaults(registry, projectType, cloudProvider);
        const violations: string[] = [];

        for (const id of defaults) {
          const def = registry.get(id)!;
          for (const requiredId of def.requires) {
            if (!defaults.includes(requiredId as RecipeId)) {
              violations.push(`${id} requires ${requiredId} which is not in defaults`);
            }
          }
        }

        expect(violations).toEqual([]);
      },
    );
  });

  describe('all default recipes are compatible with project type', () => {
    it.each(combos.map((c) => [
      `${c.projectType} / ${c.cloudProvider} / ${c.httpAdapter}`,
      c,
    ]))(
      '%s',
      (_label, combo) => {
        const { projectType, cloudProvider } = combo as {
          projectType: ProjectType;
          cloudProvider: CloudProvider;
        };
        const defaults = computeDefaults(registry, projectType, cloudProvider);
        const violations: string[] = [];

        for (const id of defaults) {
          const def = registry.get(id)!;
          if (def.compatibleWith !== 'all' && !def.compatibleWith.includes(projectType)) {
            violations.push(
              `${id} is not compatible with ${projectType} (compatibleWith: [${def.compatibleWith.join(', ')}])`,
            );
          }
        }

        expect(violations).toEqual([]);
      },
    );
  });

  describe('validateConfig accepts each default preset combo', () => {
    it.each(combos.map((c) => [
      `${c.projectType} / ${c.cloudProvider} / ${c.httpAdapter}`,
      c,
    ]))(
      '%s',
      (_label, combo) => {
        const { projectType, cloudProvider, httpAdapter } = combo as {
          projectType: ProjectType;
          cloudProvider: CloudProvider;
          httpAdapter: HttpAdapter;
        };
        const defaults = computeDefaults(registry, projectType, cloudProvider);

        const config = makeConfig({
          projectType,
          cloudProvider,
          httpAdapter,
          recipes: defaults,
          outputDir: '/tmp/test',
          ...(projectType === 'microservice' && { transportLayer: 'tcp' as const }),
          ...(projectType === 'full-stack' && { frontendFramework: 'nextjs' as const }),
        });

        const result = validateConfig(config);
        if (!result.success) {
          fail(
            `validateConfig rejected defaults for ${projectType}/${cloudProvider}/${httpAdapter}: ` +
              result.errors.map((e) => `${e.field}: ${e.message}`).join('; '),
          );
        }
      },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Generate with each default preset and verify output integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('Generate with default presets', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  // Test a representative subset: each project type with its most common cloud provider
  const generateCases: Array<{
    projectType: ProjectType;
    cloudProvider: CloudProvider;
    httpAdapter: HttpAdapter;
  }> = [
    { projectType: 'http-api', cloudProvider: 'none', httpAdapter: 'fastify' },
    { projectType: 'http-api', cloudProvider: 'aws', httpAdapter: 'fastify' },
    { projectType: 'http-api', cloudProvider: 'gcp', httpAdapter: 'express' },
    { projectType: 'http-api', cloudProvider: 'azure', httpAdapter: 'fastify' },
    { projectType: 'aws-lambda', cloudProvider: 'aws', httpAdapter: 'fastify' },
    { projectType: 'aws-lambda', cloudProvider: 'none', httpAdapter: 'express' },
    { projectType: 'microservice', cloudProvider: 'none', httpAdapter: 'fastify' },
    { projectType: 'microservice', cloudProvider: 'aws', httpAdapter: 'fastify' },
    { projectType: 'cli-app', cloudProvider: 'none', httpAdapter: 'fastify' },
    { projectType: 'cli-app', cloudProvider: 'gcp', httpAdapter: 'fastify' },
    { projectType: 'scheduled-worker', cloudProvider: 'none', httpAdapter: 'fastify' },
    { projectType: 'scheduled-worker', cloudProvider: 'azure', httpAdapter: 'fastify' },
    { projectType: 'monorepo', cloudProvider: 'none', httpAdapter: 'fastify' },
    { projectType: 'full-stack', cloudProvider: 'none', httpAdapter: 'fastify' },
  ];

  describe.each(generateCases.map((c) => [
    `${c.projectType} / ${c.cloudProvider} / ${c.httpAdapter}`,
    c,
  ]))(
    '%s',
    (_label, testCase) => {
      let outputDir: string;
      let defaults: RecipeId[];
      const { projectType, cloudProvider, httpAdapter } = testCase as {
        projectType: ProjectType;
        cloudProvider: CloudProvider;
        httpAdapter: HttpAdapter;
      };

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-preset-${projectType}-${cloudProvider}-${httpAdapter}-`),
        );
        defaults = computeDefaults(registry, projectType, cloudProvider);
        const config = makeConfig({
          outputDir,
          projectType,
          cloudProvider,
          httpAdapter,
          recipes: defaults,
          ...(projectType === 'microservice' && { transportLayer: 'tcp' as const }),
          ...(projectType === 'full-stack' && { frontendFramework: 'nextjs' as const }),
        });
        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('generates without error and produces package.json', () => {
        expect(fileExists(outputDir, 'package.json')).toBe(true);
      });

      it('no empty files in src/ (excluding .gitkeep placeholders)', () => {
        const srcDir =
          projectType === 'full-stack' || projectType === 'monorepo'
            ? path.join(outputDir, 'apps', 'api', 'src')
            : path.join(outputDir, 'src');

        if (!fs.existsSync(srcDir)) return;

        const emptyFiles: string[] = [];
        const walk = (dir: string): void => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(full);
            } else {
              // .gitkeep files are intentionally empty scaffold placeholders
              if (entry.name === '.gitkeep') continue;
              const content = fs.readFileSync(full, 'utf-8');
              if (content.trim().length === 0) {
                emptyFiles.push(path.relative(outputDir, full));
              }
            }
          }
        };
        walk(srcDir);

        expect(emptyFiles).toEqual([]);
      });

      it('no raw EJS tags in generated files', () => {
        const rawEjsFiles: string[] = [];
        const walk = (dir: string): void => {
          if (!fs.existsSync(dir)) return;
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              if (entry.name === 'node_modules' || entry.name === '.git') continue;
              walk(full);
            } else if (
              entry.name.endsWith('.ts') ||
              entry.name.endsWith('.json') ||
              entry.name.endsWith('.md')
            ) {
              const content = fs.readFileSync(full, 'utf-8');
              // Check for unrendered EJS tags
              if (/<%[^%]/.test(content) || /%>/.test(content)) {
                rawEjsFiles.push(path.relative(outputDir, full));
              }
            }
          }
        };
        walk(outputDir);

        expect(rawEjsFiles).toEqual([]);
      });

      it('main.ts exists and is non-empty', () => {
        const mainTsPath =
          projectType === 'full-stack' || projectType === 'monorepo'
            ? 'apps/api/src/main.ts'
            : 'src/main.ts';

        expect(fileExists(outputDir, mainTsPath)).toBe(true);
        const content = readFile(outputDir, mainTsPath);
        expect(content.trim().length).toBeGreaterThan(0);
      });

      it('package.json is valid JSON with no duplicate keys in deps', () => {
        const pkg = readJson(outputDir, 'package.json');
        expect(pkg.name).toBeDefined();

        const deps = (pkg.dependencies ?? {}) as Record<string, string>;
        const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;

        // Check for version conflicts (same package in both deps and devDeps
        // with different versions)
        const conflicts: string[] = [];
        for (const [name, ver] of Object.entries(devDeps)) {
          if (deps[name] && deps[name] !== ver) {
            conflicts.push(`${name}: deps=${deps[name]} vs devDeps=${ver}`);
          }
        }

        expect(conflicts).toEqual([]);
      });
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Best practices for non-HTTP project types
//    BEST_PRACTICES includes helmet, cors which are HTTP-only.
//    The computeDefaults function filters by registry.getCompatibleWith(projectType),
//    so these should be automatically excluded for non-HTTP types.
// ─────────────────────────────────────────────────────────────────────────────

describe('Best practices filtering for non-HTTP project types', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('helmet is HTTP-only (not compatibleWith cli-app, scheduled-worker, microservice)', () => {
    const helmet = registry.get('helmet')!;
    expect(helmet.compatibleWith).not.toBe('all');
    if (helmet.compatibleWith !== 'all') {
      expect(helmet.compatibleWith).not.toContain('cli-app');
      expect(helmet.compatibleWith).not.toContain('scheduled-worker');
      expect(helmet.compatibleWith).not.toContain('microservice');
    }
  });

  it('cors is HTTP-only (not compatibleWith cli-app, scheduled-worker, microservice)', () => {
    const cors = registry.get('cors')!;
    expect(cors.compatibleWith).not.toBe('all');
    if (cors.compatibleWith !== 'all') {
      expect(cors.compatibleWith).not.toContain('cli-app');
      expect(cors.compatibleWith).not.toContain('scheduled-worker');
      expect(cors.compatibleWith).not.toContain('microservice');
    }
  });

  it('computeDefaults filters out helmet for cli-app', () => {
    const defaults = computeDefaults(registry, 'cli-app', 'none');
    expect(defaults).not.toContain('helmet');
  });

  it('computeDefaults filters out cors for cli-app', () => {
    const defaults = computeDefaults(registry, 'cli-app', 'none');
    expect(defaults).not.toContain('cors');
  });

  it('computeDefaults filters out helmet for scheduled-worker', () => {
    const defaults = computeDefaults(registry, 'scheduled-worker', 'none');
    expect(defaults).not.toContain('helmet');
  });

  it('computeDefaults filters out cors for scheduled-worker', () => {
    const defaults = computeDefaults(registry, 'scheduled-worker', 'none');
    expect(defaults).not.toContain('cors');
  });

  it('computeDefaults filters out helmet for microservice', () => {
    const defaults = computeDefaults(registry, 'microservice', 'none');
    expect(defaults).not.toContain('helmet');
  });

  it('computeDefaults filters out cors for microservice', () => {
    const defaults = computeDefaults(registry, 'microservice', 'none');
    expect(defaults).not.toContain('cors');
  });

  it('computeDefaults keeps helmet for http-api', () => {
    const defaults = computeDefaults(registry, 'http-api', 'none');
    expect(defaults).toContain('helmet');
  });

  it('computeDefaults keeps cors for http-api', () => {
    const defaults = computeDefaults(registry, 'http-api', 'none');
    expect(defaults).toContain('cors');
  });

  // BUG: throttler is in PROJECT_TYPE_DEFAULTS for http-api but not listed in
  // BEST_PRACTICES. It IS correctly restricted to HTTP project types in the
  // recipe definition (compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo']).
  // However, it is NOT listed for aws-lambda in PROJECT_TYPE_DEFAULTS even though
  // it's compatible. This is arguably a missing default rather than a bug.
  it('throttler is included in http-api defaults', () => {
    const defaults = computeDefaults(registry, 'http-api', 'none');
    expect(defaults).toContain('throttler');
  });

  it('throttler is NOT included in aws-lambda defaults (missing default, not a bug per se)', () => {
    const defaults = computeDefaults(registry, 'aws-lambda', 'none');
    expect(defaults).not.toContain('throttler');
  });

  // FIXED: correlation-id and request-logging are now HTTP-only (compatibleWith
  // restricted to http-api, aws-lambda, full-stack, monorepo). computeDefaults
  // correctly filters them out for non-HTTP project types.
  it('correlation-id is correctly filtered out from cli-app defaults (now HTTP-only)', () => {
    const defaults = computeDefaults(registry, 'cli-app', 'none');
    expect(defaults).not.toContain('correlation-id');

    const corr = registry.get('correlation-id')!;
    // FIXED: compatibleWith is now restricted to HTTP project types
    expect(corr.compatibleWith).not.toBe('all');
    if (corr.compatibleWith !== 'all') {
      expect(corr.compatibleWith).not.toContain('cli-app');
    }
  });

  it('request-logging is correctly filtered out from cli-app defaults (now HTTP-only)', () => {
    const defaults = computeDefaults(registry, 'cli-app', 'none');
    expect(defaults).not.toContain('request-logging');

    const reqLog = registry.get('request-logging')!;
    // FIXED: same fix as correlation-id
    expect(reqLog.compatibleWith).not.toBe('all');
    if (reqLog.compatibleWith !== 'all') {
      expect(reqLog.compatibleWith).not.toContain('cli-app');
    }
  });

  it('BUG: graceful-shutdown is included in cli-app defaults (compatibleWith: all)', () => {
    const defaults = computeDefaults(registry, 'cli-app', 'none');
    // graceful-shutdown has compatibleWith: 'all'. For cli-app this is arguably useful
    // (Commander apps can trap SIGTERM too), so this may be intentional, unlike
    // correlation-id and request-logging which generate HTTP middleware.
    expect(defaults).toContain('graceful-shutdown');
  });

  // Verify that the filtered defaults for non-HTTP types are EXACTLY what we expect
  it('cli-app defaults are only: graceful-shutdown', () => {
    const defaults = computeDefaults(registry, 'cli-app', 'none');
    // After filtering:
    // - helmet: filtered out (HTTP-only)
    // - cors: filtered out (HTTP-only)
    // - graceful-shutdown: included (compatibleWith: 'all')
    // - correlation-id: filtered out (now HTTP-only)
    // - request-logging: filtered out (now HTTP-only)
    // - PROJECT_TYPE_DEFAULTS for cli-app: [] (empty)
    expect(defaults.sort()).toEqual(
      ['graceful-shutdown'].sort(),
    );
  });

  it('scheduled-worker defaults include bullmq, pino plus filtered best practices', () => {
    const defaults = computeDefaults(registry, 'scheduled-worker', 'none');
    // BEST_PRACTICES filtered:
    // - helmet: filtered out (HTTP-only)
    // - cors: filtered out (HTTP-only)
    // - graceful-shutdown: included (compatibleWith: 'all')
    // - correlation-id: filtered out (now HTTP-only)
    // - request-logging: filtered out (now HTTP-only)
    // PROJECT_TYPE_DEFAULTS: bullmq, pino, health-checks
    // - health-checks: filtered out (now excludes microservice/scheduled-worker)
    expect(defaults).toContain('bullmq');
    expect(defaults).toContain('pino');
    expect(defaults).not.toContain('health-checks');
    expect(defaults).toContain('graceful-shutdown');
    expect(defaults).not.toContain('correlation-id');
    expect(defaults).not.toContain('request-logging');
    expect(defaults).not.toContain('helmet');
    expect(defaults).not.toContain('cors');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cloud defaults + project type interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Cloud defaults + project type interaction', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  // Cloud recipes have compatibleWith: 'all', so they should be included for all project types
  it('AWS cloud defaults are included for all project types', () => {
    for (const pt of PROJECT_TYPES) {
      const defaults = computeDefaults(registry, pt, 'aws');
      expect(defaults).toContain('aws-secrets-manager');
      expect(defaults).toContain('aws-s3');
    }
  });

  it('GCP cloud defaults are included for all project types', () => {
    for (const pt of PROJECT_TYPES) {
      const defaults = computeDefaults(registry, pt, 'gcp');
      expect(defaults).toContain('gcp-secret-manager');
      expect(defaults).toContain('gcp-cloud-storage');
    }
  });

  it('Azure cloud defaults are included for all project types', () => {
    for (const pt of PROJECT_TYPES) {
      const defaults = computeDefaults(registry, pt, 'azure');
      expect(defaults).toContain('azure-key-vault');
      expect(defaults).toContain('azure-blob-storage');
    }
  });

  // BUG: GCP cloud defaults work fine with aws-lambda project type, but this is
  // semantically questionable. The validator does not enforce cloud provider alignment
  // with project type. An aws-lambda project with gcp defaults will have GCP SDK
  // packages installed alongside AWS Lambda runtime packages.
  it('BUG: GCP defaults are accepted for aws-lambda project type (no cloud-type alignment)', () => {
    const defaults = computeDefaults(registry, 'aws-lambda', 'gcp');
    expect(defaults).toContain('gcp-secret-manager');
    expect(defaults).toContain('gcp-cloud-storage');

    const config = makeConfig({
      projectType: 'aws-lambda',
      cloudProvider: 'gcp',
      recipes: defaults,
      outputDir: '/tmp/test',
    });
    const result = validateConfig(config);
    // The validator accepts this combo even though it is semantically odd
    expect(result.success).toBe(true);
  });

  it('BUG: Azure defaults are accepted for aws-lambda project type', () => {
    const defaults = computeDefaults(registry, 'aws-lambda', 'azure');
    expect(defaults).toContain('azure-key-vault');
    expect(defaults).toContain('azure-blob-storage');

    const config = makeConfig({
      projectType: 'aws-lambda',
      cloudProvider: 'azure',
      recipes: defaults,
      outputDir: '/tmp/test',
    });
    const result = validateConfig(config);
    expect(result.success).toBe(true);
  });

  // aws-s3 conflicts with s3-minio. Verify this does not apply to defaults.
  it('aws-s3 from CLOUD_DEFAULTS does not conflict with any other default recipe', () => {
    for (const pt of PROJECT_TYPES) {
      const defaults = computeDefaults(registry, pt, 'aws');
      const awsS3 = registry.get('aws-s3')!;
      for (const conflictId of awsS3.conflicts) {
        expect(defaults).not.toContain(conflictId);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Generate with cloud defaults + mismatched project type to verify
//    output integrity even in edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Cloud defaults cross-project-type generation', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  // BUG: Generating aws-lambda with GCP defaults produces a project with both
  // AWS Lambda runtime deps and GCP SDK deps. The manifest says cloudProvider: 'gcp'
  // but the project type is aws-lambda. No validation prevents this.
  it('BUG: aws-lambda + gcp defaults generates a mixed-cloud project', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-preset-lambda-gcp-'),
    );

    try {
      const defaults = computeDefaults(registry, 'aws-lambda', 'gcp');
      const config = makeConfig({
        outputDir,
        projectType: 'aws-lambda',
        cloudProvider: 'gcp',
        httpAdapter: 'fastify',
        recipes: defaults,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const pkg = readJson(outputDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      // GCP deps from cloud defaults
      expect(deps['@google-cloud/secret-manager']).toBeDefined();
      expect(deps['@google-cloud/storage']).toBeDefined();

      // AWS deps from the aws-lambda project type
      expect(deps['@fastify/aws-lambda']).toBeDefined();

      // BUG: Manifest says gcp but project is aws-lambda with AWS runtime deps
      const manifest = readJson(outputDir, '.spoonfeed.json');
      expect(manifest.cloudProvider).toBe('gcp');
      expect(manifest.projectType).toBe('aws-lambda');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('cli-app + aws defaults generates without error', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-preset-cli-aws-'),
    );

    try {
      const defaults = computeDefaults(registry, 'cli-app', 'aws');
      const config = makeConfig({
        outputDir,
        projectType: 'cli-app',
        cloudProvider: 'aws',
        recipes: defaults,
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'package.json')).toBe(true);

      const pkg = readJson(outputDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      // AWS defaults should be present
      expect(deps['@aws-sdk/client-secrets-manager']).toBeDefined();
      expect(deps['@aws-sdk/client-s3']).toBeDefined();

      // No HTTP adapter deps
      expect(deps['@nestjs/platform-fastify']).toBeUndefined();
      expect(deps['@nestjs/platform-express']).toBeUndefined();
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('scheduled-worker + azure defaults generates without error', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-preset-worker-azure-'),
    );

    try {
      const defaults = computeDefaults(registry, 'scheduled-worker', 'azure');
      const config = makeConfig({
        outputDir,
        projectType: 'scheduled-worker',
        cloudProvider: 'azure',
        recipes: defaults,
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'package.json')).toBe(true);

      const pkg = readJson(outputDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      // Azure defaults
      expect(deps['@azure/keyvault-secrets']).toBeDefined();
      expect(deps['@azure/storage-blob']).toBeDefined();

      // scheduled-worker type defaults
      expect(deps['@nestjs/bullmq']).toBeDefined();
      expect(deps['nestjs-pino']).toBeDefined();
      // health-checks is now HTTP-only (excludes scheduled-worker), so @nestjs/terminus
      // is no longer in defaults for scheduled-worker
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Verify http-api defaults produce a fully functional project
// ─────────────────────────────────────────────────────────────────────────────

describe('http-api default preset full verification', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it.each([
    ['fastify', 'none'],
    ['express', 'none'],
    ['fastify', 'aws'],
    ['express', 'gcp'],
  ] as const)(
    'http-api / %s / %s: all default recipe deps land in package.json',
    async (httpAdapter, cloudProvider) => {
      const outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-httpapi-${httpAdapter}-${cloudProvider}-`),
      );

      try {
        const defaults = computeDefaults(registry, 'http-api', cloudProvider);
        const config = makeConfig({
          outputDir,
          projectType: 'http-api',
          cloudProvider,
          httpAdapter,
          recipes: defaults,
        });
        await generate(config, registry, TEMPLATES_DIR);

        const pkg = readJson(outputDir, 'package.json');
        const allDeps = {
          ...((pkg.dependencies ?? {}) as Record<string, string>),
          ...((pkg.devDependencies ?? {}) as Record<string, string>),
        };

        for (const id of defaults) {
          const def = registry.get(id)!;
          const recipeDeps =
            httpAdapter === 'express' && def.expressDependencies
              ? def.expressDependencies
              : def.dependencies;
          for (const dep of Object.keys(recipeDeps)) {
            expect(allDeps).toHaveProperty(dep);
          }
        }
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    },
  );

  it('http-api / fastify / none: swagger mainTsSetup block is applied to main.ts', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-httpapi-swagger-'),
    );

    try {
      const defaults = computeDefaults(registry, 'http-api', 'none');
      expect(defaults).toContain('swagger');

      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        cloudProvider: 'none',
        httpAdapter: 'fastify',
        recipes: defaults,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'src/main.ts');
      // Swagger setup block should be in main.ts
      expect(mainTs).toContain('SwaggerModule');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('http-api / express / none: swagger mainTsSetup block uses express variant', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-httpapi-swagger-express-'),
    );

    try {
      const defaults = computeDefaults(registry, 'http-api', 'none');
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        cloudProvider: 'none',
        httpAdapter: 'express',
        recipes: defaults,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'src/main.ts');
      expect(mainTs).toContain('SwaggerModule');
      // Express variant should NOT have @fastify/static
      expect(mainTs).not.toContain('@fastify/static');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. BUG: Non-HTTP types with default recipes that generate HTTP middleware
//    Verify the dead-code middleware files are produced
// ─────────────────────────────────────────────────────────────────────────────

describe('FIXED: Non-HTTP project types no longer get HTTP middleware from defaults', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  // FIXED: correlation-id is now HTTP-only and filtered out from cli-app defaults.
  it('cli-app with defaults does NOT include correlation-id (now HTTP-only)', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-preset-fixed-cli-'),
    );

    try {
      const defaults = computeDefaults(registry, 'cli-app', 'none');
      expect(defaults).not.toContain('correlation-id');

      const config = makeConfig({
        outputDir,
        projectType: 'cli-app',
        recipes: defaults,
      });
      await generate(config, registry, TEMPLATES_DIR);

      // No HTTP middleware should be generated for cli-app defaults
      expect(
        fileExists(outputDir, 'src/shared/middleware/correlation-id.middleware.ts'),
      ).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  // FIXED: request-logging is now HTTP-only and filtered out from scheduled-worker defaults.
  it('scheduled-worker with defaults does NOT include request-logging (now HTTP-only)', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-preset-fixed-worker-'),
    );

    try {
      const defaults = computeDefaults(registry, 'scheduled-worker', 'none');
      expect(defaults).not.toContain('request-logging');

      const config = makeConfig({
        outputDir,
        projectType: 'scheduled-worker',
        recipes: defaults,
      });
      await generate(config, registry, TEMPLATES_DIR);

      // No HTTP middleware should be generated for scheduled-worker defaults
      expect(
        fileExists(outputDir, 'src/shared/middleware/request-logging.middleware.ts'),
      ).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  // FIXED: correlation-id and request-logging are now HTTP-only and filtered out
  // from microservice defaults.
  it('microservice with defaults does NOT include correlation-id or request-logging (now HTTP-only)', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-preset-fixed-ms-'),
    );

    try {
      const defaults = computeDefaults(registry, 'microservice', 'none');
      expect(defaults).not.toContain('correlation-id');
      expect(defaults).not.toContain('request-logging');

      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'tcp',
        recipes: defaults,
      });
      await generate(config, registry, TEMPLATES_DIR);

      // No HTTP middleware files should be generated for microservice defaults
      expect(
        fileExists(outputDir, 'src/shared/middleware/correlation-id.middleware.ts'),
      ).toBe(false);
      expect(
        fileExists(outputDir, 'src/shared/middleware/request-logging.middleware.ts'),
      ).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Deduplication: verify no duplicate recipes in computed defaults
// ─────────────────────────────────────────────────────────────────────────────

describe('No duplicate recipes in computed defaults', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  // pino appears in BOTH PROJECT_TYPE_DEFAULTS for several project types.
  // computeDefaults uses Set dedup, so it should only appear once.
  it('pino is not duplicated for http-api (appears in PROJECT_TYPE_DEFAULTS)', () => {
    const defaults = computeDefaults(registry, 'http-api', 'none');
    const pinoCount = defaults.filter((id) => id === 'pino').length;
    expect(pinoCount).toBeLessThanOrEqual(1);
  });

  it('health-checks is not duplicated for scheduled-worker', () => {
    const defaults = computeDefaults(registry, 'scheduled-worker', 'none');
    const count = defaults.filter((id) => id === 'health-checks').length;
    expect(count).toBeLessThanOrEqual(1);
  });

  it('no duplicates in any project type / cloud provider combo', () => {
    for (const pt of PROJECT_TYPES) {
      for (const cp of CLOUD_PROVIDERS) {
        const defaults = computeDefaults(registry, pt, cp);
        const uniqueDefaults = [...new Set(defaults)];
        expect(defaults).toEqual(uniqueDefaults);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Verify the computeDefaults filtering matches the runtime behavior
//     in runAllPrompts (registry.getCompatibleWith filters the available set)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDefaults filtering matches registry.getCompatibleWith', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('every recipe in computed defaults passes registry.getCompatibleWith filter', () => {
    for (const pt of PROJECT_TYPES) {
      const compatibleIds = new Set(registry.getCompatibleWith(pt).map((r) => r.id));

      for (const cp of CLOUD_PROVIDERS) {
        const defaults = computeDefaults(registry, pt, cp);
        for (const id of defaults) {
          expect(compatibleIds.has(id)).toBe(true);
        }
      }
    }
  });

  it('every recipe NOT in defaults for a given type is correctly filtered because it is not compatible', () => {
    // For cli-app, helmet should NOT be in computed defaults because it is not
    // in getCompatibleWith('cli-app')
    const cliAppCompatible = new Set(registry.getCompatibleWith('cli-app').map((r) => r.id));
    expect(cliAppCompatible.has('helmet')).toBe(false);
    expect(cliAppCompatible.has('cors')).toBe(false);
    expect(cliAppCompatible.has('swagger')).toBe(false);
    expect(cliAppCompatible.has('throttler')).toBe(false);
  });

  // BUG: bullmq compatibleWith excludes cli-app. This is correct.
  it('bullmq is correctly excluded from cli-app (not in compatibleWith)', () => {
    const bullmq = registry.get('bullmq')!;
    expect(bullmq.compatibleWith).not.toBe('all');
    if (bullmq.compatibleWith !== 'all') {
      expect(bullmq.compatibleWith).not.toContain('cli-app');
    }
    const defaults = computeDefaults(registry, 'cli-app', 'none');
    expect(defaults).not.toContain('bullmq');
  });

  // swagger is NOT in computeDefaults for microservice because it is not in
  // PROJECT_TYPE_DEFAULTS for microservice, AND it is correctly excluded
  // from microservice's compatibleWith
  it('swagger is NOT in microservice defaults (not compatible and not in PROJECT_TYPE_DEFAULTS)', () => {
    const swagger = registry.get('swagger')!;
    if (swagger.compatibleWith !== 'all') {
      expect(swagger.compatibleWith).not.toContain('microservice');
    }
    const defaults = computeDefaults(registry, 'microservice', 'none');
    expect(defaults).not.toContain('swagger');
  });
});
