import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { generate } from '@spoonfeed/generator/generator';
import { PROJECT_TYPES } from '@spoonfeed/types';
import type { ProjectConfig, ProjectType, RecipeDefinition } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const NON_HTTP_PROJECT_TYPES: ProjectType[] = ['cli-app', 'scheduled-worker'];
const HTTP_PROJECT_TYPES: ProjectType[] = ['http-api', 'aws-lambda', 'full-stack', 'monorepo'];

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'compat-test-project',
    scope: undefined,
    projectType: 'http-api',
    cloudProvider: 'none',
    httpAdapter: 'express',
    recipes: [],
    transportLayer: undefined,
    frontendFramework: undefined,
    deploymentTargets: [],
    ciCdProvider: undefined,
    outputDir: '',
    ...overrides,
  };
}

describe('Recipe compatibility matrix', () => {
  let recipes: RecipeDefinition[];
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
    recipes = registry.getAll();
  });

  // ── Test 1: HTTP-only recipes should not include non-HTTP project types ──
  describe('mainTsSetup recipes exclude non-HTTP project types', () => {
    it('recipes with mainTsSetup should not be compatible with cli-app or scheduled-worker', () => {
      const violations: string[] = [];

      for (const recipe of recipes) {
        if (!recipe.mainTsSetup && !recipe.expressMainTsSetup) continue;
        if (recipe.compatibleWith === 'all') {
          violations.push(
            `${recipe.id}: has mainTsSetup but compatibleWith is 'all' (includes cli-app and scheduled-worker)`,
          );
          continue;
        }

        for (const nonHttp of NON_HTTP_PROJECT_TYPES) {
          if (recipe.compatibleWith.includes(nonHttp)) {
            violations.push(
              `${recipe.id}: has mainTsSetup but compatibleWith includes '${nonHttp}'`,
            );
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // ── Test 2: Fastify-dep recipes should not include non-HTTP project types ──
  describe('fastify-dependent recipes exclude non-HTTP project types', () => {
    it('recipes with @fastify/* dependencies should not be compatible with non-HTTP project types', () => {
      const violations: string[] = [];

      for (const recipe of recipes) {
        const hasFastifyDep = Object.keys(recipe.dependencies).some((dep) =>
          dep.startsWith('@fastify/'),
        );
        if (!hasFastifyDep) continue;

        if (recipe.compatibleWith === 'all') {
          violations.push(
            `${recipe.id}: has @fastify/* deps but compatibleWith is 'all' (includes non-HTTP types)`,
          );
          continue;
        }

        for (const nonHttp of NON_HTTP_PROJECT_TYPES) {
          if (recipe.compatibleWith.includes(nonHttp)) {
            violations.push(
              `${recipe.id}: has @fastify/* deps but compatibleWith includes '${nonHttp}'`,
            );
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // ── Test 3: graphql-mercurius should document Fastify-only compatibility ──
  describe('graphql-mercurius Fastify-only awareness', () => {
    it('graphql-mercurius description or name should indicate it is Fastify-only', () => {
      const mercurius = recipes.find((r) => r.id === 'graphql-mercurius');
      expect(mercurius).toBeDefined();

      const hasFastifyIndication =
        mercurius!.name.toLowerCase().includes('fastify') ||
        mercurius!.description.toLowerCase().includes('fastify');

      expect(hasFastifyIndication).toBe(true);
    });

    it('graphql-mercurius should only include HTTP project types in compatibleWith', () => {
      const mercurius = recipes.find((r) => r.id === 'graphql-mercurius');
      expect(mercurius).toBeDefined();
      expect(mercurius!.compatibleWith).not.toBe('all');

      if (mercurius!.compatibleWith !== 'all') {
        for (const nonHttp of NON_HTTP_PROJECT_TYPES) {
          expect(mercurius!.compatibleWith).not.toContain(nonHttp);
        }
      }
    });

    it('graphql-mercurius compatibleWith should be a subset of HTTP project types', () => {
      const mercurius = recipes.find((r) => r.id === 'graphql-mercurius');
      expect(mercurius).toBeDefined();

      if (mercurius!.compatibleWith !== 'all') {
        const httpSet = new Set<string>(HTTP_PROJECT_TYPES);
        for (const pt of mercurius!.compatibleWith) {
          expect(httpSet.has(pt)).toBe(true);
        }
      }
    });
  });

  // ── Test 4: All project types in compatibleWith are valid ──
  describe('compatibleWith values are valid project types', () => {
    it('every compatibleWith entry should be a known project type', () => {
      const validTypes = new Set<string>(PROJECT_TYPES);
      const violations: string[] = [];

      for (const recipe of recipes) {
        if (recipe.compatibleWith === 'all') continue;

        const invalid = recipe.compatibleWith.filter((t) => !validTypes.has(t));
        if (invalid.length > 0) {
          violations.push(`${recipe.id}: unknown types [${invalid.join(', ')}]`);
        }
      }

      expect(violations).toEqual([]);
    });

    it('compatibleWith arrays should not be empty', () => {
      const violations: string[] = [];

      for (const recipe of recipes) {
        if (recipe.compatibleWith === 'all') continue;
        if (recipe.compatibleWith.length === 0) {
          violations.push(`${recipe.id}: compatibleWith is an empty array`);
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // ── Test 5: Generate each project type with a universal recipe ──
  describe('universal recipe generates successfully for every project type', () => {
    let universalRecipeId: 'config-validation' | 'pino';

    beforeAll(() => {
      const configValidation = recipes.find((r) => r.id === 'config-validation');
      const pino = recipes.find((r) => r.id === 'pino');

      // Prefer config-validation (no mainTsSetup, minimal footprint), fall back to pino
      if (configValidation && configValidation.compatibleWith === 'all') {
        universalRecipeId = 'config-validation';
      } else if (pino && pino.compatibleWith === 'all') {
        universalRecipeId = 'pino';
      } else {
        throw new Error('Neither config-validation nor pino is compatibleWith: all');
      }
    });

    it.each(PROJECT_TYPES.map((pt) => [pt]))('%s: generates without error', async (projectType) => {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-compat-${projectType}-`));

      try {
        const configOverrides: Partial<ProjectConfig> = {
          outputDir,
          projectType,
          recipes: [universalRecipeId],
        };

        // Set httpAdapter: express for HTTP types, fastify for non-HTTP
        if (HTTP_PROJECT_TYPES.includes(projectType)) {
          configOverrides.httpAdapter = 'express';
        } else {
          configOverrides.httpAdapter = 'fastify';
        }

        // Set transportLayer for microservice
        if (projectType === 'microservice') {
          configOverrides.transportLayer = 'tcp';
        }

        // Set frontendFramework for full-stack
        if (projectType === 'full-stack') {
          configOverrides.frontendFramework = 'nextjs';
        }

        const config = makeConfig(configOverrides);
        await generate(config, registry, TEMPLATES_DIR);

        // Verify package.json was created
        const pkgJsonPath = path.join(outputDir, 'package.json');
        expect(fs.existsSync(pkgJsonPath)).toBe(true);

        // Verify the recipe dependency landed in package.json
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const allDeps = {
          ...((pkgJson.dependencies ?? {}) as Record<string, string>),
          ...((pkgJson.devDependencies ?? {}) as Record<string, string>),
        };

        const recipeDef = registry.get(universalRecipeId)!;
        const expectedDeps = Object.keys(recipeDef.dependencies);
        for (const dep of expectedDeps) {
          expect(allDeps).toHaveProperty(dep);
        }
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });
});
