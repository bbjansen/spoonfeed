import { validateConfig } from '@spoonfeed/validation/config-validator';
import { detectConflicts } from '@spoonfeed/validation/conflict-detector';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, RecipeId } from '@spoonfeed/types';

/**
 * Integration test that hammers config validation + conflict detection with
 * edge cases. Each test documents whether the edge case is properly caught by
 * the current validator or represents a gap.
 */

const registry = new RecipeRegistry();
registerAllRecipes(registry);
const allRecipes = registry.getAll();

/** Minimal valid config to use as a base for overrides. */
const validConfig: ProjectConfig = {
  name: 'my-api',
  scope: '@myorg',
  projectType: 'http-api',
  cloudProvider: 'aws',
  httpAdapter: 'fastify',
  recipes: [],
  transportLayer: undefined,
  frontendFramework: undefined,
  deploymentTargets: ['dockerfile'],
  ciCdProvider: 'github-actions',
  outputDir: './out',
};

function expectFailure(result: ReturnType<typeof validateConfig>, field?: string) {
  expect(result.success).toBe(false);
  if (!result.success && field) {
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Invalid project names
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: project name edge cases', () => {
  it('rejects empty name', () => {
    const result = validateConfig({ ...validConfig, name: '' });
    expectFailure(result, 'name');
  });

  it('rejects name with spaces', () => {
    const result = validateConfig({ ...validConfig, name: 'my api' });
    expectFailure(result, 'name');
  });

  it('rejects uppercase name', () => {
    const result = validateConfig({ ...validConfig, name: 'MyApi' });
    expectFailure(result, 'name');
  });

  it('rejects name with special characters', () => {
    const result = validateConfig({ ...validConfig, name: 'my_api!' });
    expectFailure(result, 'name');
  });

  it('rejects name starting with a hyphen', () => {
    const result = validateConfig({ ...validConfig, name: '-my-api' });
    expectFailure(result, 'name');
  });

  it('accepts name with hyphens and numbers', () => {
    const result = validateConfig({ ...validConfig, name: 'my-api-2' });
    expect(result.success).toBe(true);
  });

  it('accepts single character name', () => {
    const result = validateConfig({ ...validConfig, name: 'a' });
    expect(result.success).toBe(true);
  });

  it('does not enforce a maximum name length (gap: no max-length validation)', () => {
    // The Zod schema has no .max() on name — very long names are accepted.
    const longName = 'a'.repeat(300);
    const result = validateConfig({ ...validConfig, name: longName });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Invalid scope
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: scope edge cases', () => {
  it('rejects scope missing @ prefix', () => {
    const result = validateConfig({ ...validConfig, scope: 'myorg' });
    expectFailure(result, 'scope');
  });

  it('rejects scope with uppercase letters', () => {
    const result = validateConfig({ ...validConfig, scope: '@MyOrg' });
    expectFailure(result, 'scope');
  });

  it('rejects scope with special characters', () => {
    const result = validateConfig({ ...validConfig, scope: '@my_org!' });
    expectFailure(result, 'scope');
  });

  it('rejects scope that is just @', () => {
    const result = validateConfig({ ...validConfig, scope: '@' });
    expectFailure(result, 'scope');
  });

  it('accepts undefined scope (optional)', () => {
    const result = validateConfig({ ...validConfig, scope: undefined });
    expect(result.success).toBe(true);
  });

  it('accepts valid scope', () => {
    const result = validateConfig({ ...validConfig, scope: '@my-org' });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Invalid projectType values
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: projectType edge cases', () => {
  it('rejects unknown projectType', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: 'unknown-type' as ProjectConfig['projectType'],
    });
    expectFailure(result, 'projectType');
  });

  it('rejects empty string projectType', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: '' as ProjectConfig['projectType'],
    });
    expectFailure(result, 'projectType');
  });

  it('accepts all valid project types', () => {
    const types: ProjectConfig['projectType'][] = [
      'http-api', 'aws-lambda', 'microservice', 'cli-app',
      'scheduled-worker', 'monorepo', 'full-stack',
    ];
    for (const projectType of types) {
      const cfg: ProjectConfig = {
        ...validConfig,
        projectType,
        // Satisfy conditional requirements
        transportLayer: projectType === 'microservice' ? 'tcp' : undefined,
        frontendFramework: projectType === 'full-stack' ? 'nextjs' : undefined,
      };
      const result = validateConfig(cfg);
      expect(result.success).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. microservice without transportLayer
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: microservice requires transportLayer', () => {
  it('errors when transportLayer is undefined', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: 'microservice',
      transportLayer: undefined,
    });
    expectFailure(result, 'transportLayer');
  });

  it('passes when transportLayer is provided', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: 'microservice',
      transportLayer: 'tcp',
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. full-stack without frontendFramework
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: full-stack requires frontendFramework', () => {
  it('errors when frontendFramework is undefined', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: 'full-stack',
      frontendFramework: undefined,
    });
    expectFailure(result, 'frontendFramework');
  });

  it('passes when frontendFramework is provided', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: 'full-stack',
      frontendFramework: 'nextjs',
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Recipes that conflict with each other
// ─────────────────────────────────────────────────────────────────────────────
describe('conflict-detector: mutual exclusions', () => {
  it('catches prisma + typeorm-postgres conflict', () => {
    const conflicts = detectConflicts(['prisma', 'typeorm-postgres'], allRecipes);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    const mutual = conflicts.filter((c) => c.type === 'mutual-exclusion');
    expect(mutual.length).toBeGreaterThanOrEqual(1);
    expect(mutual.some((c) =>
      c.recipes.includes('prisma') && c.recipes.includes('typeorm-postgres'),
    )).toBe(true);
  });

  it('catches pino + winston logger conflict', () => {
    const conflicts = detectConflicts(['pino', 'winston'], allRecipes);
    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'mutual-exclusion' }),
      ]),
    );
  });

  it('catches nodemailer + sendgrid conflict', () => {
    const conflicts = detectConflicts(['nodemailer', 'sendgrid'], allRecipes);
    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'mutual-exclusion' }),
      ]),
    );
  });

  it('catches json-patch + json-merge-patch conflict', () => {
    const conflicts = detectConflicts(['json-patch', 'json-merge-patch'], allRecipes);
    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'mutual-exclusion' }),
      ]),
    );
  });

  it('catches all ORM mutual exclusions (prisma vs typeorm-mysql vs mongoose)', () => {
    const orms: RecipeId[] = [
      'typeorm-postgres', 'typeorm-mysql', 'prisma', 'mongoose',
      'drizzle-postgres', 'kysely', 'mikro-orm',
    ];
    // Picking any two ORMs should produce at least one conflict
    for (let i = 0; i < orms.length; i++) {
      for (let j = i + 1; j < orms.length; j++) {
        const conflicts = detectConflicts([orms[i], orms[j]], allRecipes);
        const mutual = conflicts.filter((c) => c.type === 'mutual-exclusion');
        expect(mutual.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Recipes that require other recipes not in the list
// ─────────────────────────────────────────────────────────────────────────────
describe('conflict-detector: missing requirements', () => {
  it('catches auth-flows without jwt-auth', () => {
    const conflicts = detectConflicts(['auth-flows'], allRecipes);
    const missing = conflicts.filter((c) => c.type === 'missing-requirement');
    expect(missing.length).toBeGreaterThanOrEqual(1);
    expect(missing.some((c) => c.recipes.includes('jwt-auth'))).toBe(true);
  });

  it('passes auth-flows when jwt-auth is present', () => {
    const conflicts = detectConflicts(['auth-flows', 'jwt-auth'], allRecipes);
    const missing = conflicts.filter((c) => c.type === 'missing-requirement');
    expect(missing).toHaveLength(0);
  });

  it('reports all missing requirements when multiple recipes have unmet deps', () => {
    // Find all recipes that have requires and test them without their dependencies
    const recipesWithRequires = allRecipes.filter((r) => r.requires.length > 0);
    for (const recipe of recipesWithRequires) {
      const conflicts = detectConflicts([recipe.id], allRecipes);
      const missing = conflicts.filter((c) => c.type === 'missing-requirement');
      expect(missing.length).toBe(recipe.requires.length);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Recipes incompatible with the selected projectType
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator + conflict-detector: projectType compatibility', () => {
  it('rejects recipes incompatible with projectType', () => {
    // graphql-mercurius is compatible with http-api, aws-lambda, full-stack, monorepo
    // but NOT with cli-app. The validator now rejects this.
    const result = validateConfig({
      ...validConfig,
      projectType: 'cli-app',
      recipes: ['graphql-mercurius'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('not compatible with project type'),
          }),
        ]),
      );
    }
  });

  it('gap: detectConflicts does not check projectType compatibility', () => {
    // websockets is only compatible with http-api, full-stack, monorepo
    // detectConflicts does not consider projectType at all
    const conflicts = detectConflicts(['websockets'], allRecipes);
    // Returns no conflicts because conflict-detector only checks mutual-exclusion
    // and missing-requirement, not projectType compatibility
    expect(conflicts).toHaveLength(0);
  });

  it('RecipeRegistry.getCompatibleWith correctly filters recipes by projectType', () => {
    const cliRecipes = registry.getCompatibleWith('cli-app');
    const cliRecipeIds = cliRecipes.map((r) => r.id);
    // graphql-mercurius and websockets should not appear for cli-app
    expect(cliRecipeIds).not.toContain('graphql-mercurius');
    expect(cliRecipeIds).not.toContain('websockets');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Duplicate recipes in the array
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: duplicate recipes', () => {
  it('gap: allows duplicate recipe IDs without error', () => {
    // Zod z.array(z.enum(...)) does not enforce uniqueness.
    const result = validateConfig({
      ...validConfig,
      recipes: ['swagger', 'swagger'],
    });
    // Documenting the gap: duplicates are accepted
    expect(result.success).toBe(true);
  });

  it('conflict-detector handles duplicates without crashing', () => {
    // detectConflicts uses a Set internally, so duplicates are handled gracefully
    const conflicts = detectConflicts(['swagger', 'swagger'], allRecipes);
    expect(conflicts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Empty recipe array
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: empty recipe array', () => {
  it('accepts an empty recipe array', () => {
    const result = validateConfig({ ...validConfig, recipes: [] });
    expect(result.success).toBe(true);
  });

  it('conflict-detector returns no conflicts for empty array', () => {
    const conflicts = detectConflicts([], allRecipes);
    expect(conflicts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Unknown recipe IDs
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: unknown recipe IDs', () => {
  it('rejects an unknown recipe ID', () => {
    const result = validateConfig({
      ...validConfig,
      recipes: ['nonexistent-recipe' as RecipeId],
    });
    expectFailure(result, 'recipes.0');
  });

  it('rejects when one valid and one unknown recipe are mixed', () => {
    const result = validateConfig({
      ...validConfig,
      recipes: ['swagger', 'totally-fake' as RecipeId],
    });
    expectFailure(result, 'recipes.1');
  });

  it('conflict-detector silently ignores unknown recipe IDs', () => {
    // If a recipe ID is not in the registry, detectConflicts skips it
    const conflicts = detectConflicts(['nonexistent' as RecipeId], allRecipes);
    expect(conflicts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. httpAdapter validation
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: httpAdapter validation', () => {
  it('accepts fastify adapter', () => {
    const result = validateConfig({ ...validConfig, httpAdapter: 'fastify' });
    expect(result.success).toBe(true);
  });

  it('accepts express adapter', () => {
    const result = validateConfig({ ...validConfig, httpAdapter: 'express' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown adapter', () => {
    const result = validateConfig({
      ...validConfig,
      httpAdapter: 'koa' as ProjectConfig['httpAdapter'],
    });
    expectFailure(result, 'httpAdapter');
  });

  it('rejects empty string adapter', () => {
    const result = validateConfig({
      ...validConfig,
      httpAdapter: '' as ProjectConfig['httpAdapter'],
    });
    expectFailure(result, 'httpAdapter');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. graphql-mercurius with Express adapter
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: graphql-mercurius + express adapter', () => {
  it('rejects graphql-mercurius with express adapter', () => {
    const result = validateConfig({
      ...validConfig,
      httpAdapter: 'express',
      recipes: ['graphql-mercurius'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Fastify'),
          }),
        ]),
      );
    }
  });

  it('conflict-detector does not check adapter compatibility (not its responsibility)', () => {
    const conflicts = detectConflicts(['graphql-mercurius'], allRecipes);
    // Adapter validation is handled by validateConfig, not conflict-detector
    expect(conflicts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Empty string for required fields
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: empty string for required fields', () => {
  it('rejects empty name', () => {
    const result = validateConfig({ ...validConfig, name: '' });
    expectFailure(result, 'name');
  });

  it('rejects empty outputDir', () => {
    const result = validateConfig({ ...validConfig, outputDir: '' });
    expectFailure(result, 'outputDir');
  });

  it('rejects empty string as projectType', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: '' as ProjectConfig['projectType'],
    });
    expectFailure(result, 'projectType');
  });

  it('rejects empty string as cloudProvider', () => {
    const result = validateConfig({
      ...validConfig,
      cloudProvider: '' as ProjectConfig['cloudProvider'],
    });
    expectFailure(result, 'cloudProvider');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Extra / unknown fields in config
//     Zod .object() strips unknown keys by default (not .strict())
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: extra / unknown fields', () => {
  it('strips unknown fields without error (Zod default behavior)', () => {
    const configWithExtra = {
      ...validConfig,
      unknownField: 'should-be-stripped',
      anotherExtra: 42,
    };
    const result = validateConfig(configWithExtra as unknown as ProjectConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      // The returned config should not include the unknown fields
      expect((result.config as Record<string, unknown>)['unknownField']).toBeUndefined();
      expect((result.config as Record<string, unknown>)['anotherExtra']).toBeUndefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bonus: combined scenarios
// ─────────────────────────────────────────────────────────────────────────────
describe('config-validator: combined edge cases', () => {
  it('reports multiple validation errors at once', () => {
    const result = validateConfig({
      ...validConfig,
      name: '',
      projectType: 'invalid' as ProjectConfig['projectType'],
      outputDir: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain('name');
      expect(fields).toContain('projectType');
      expect(fields).toContain('outputDir');
    }
  });

  it('validateConfig and detectConflicts both catch recipe conflicts', () => {
    // Step 1: validateConfig now catches conflicting recipes directly
    const config: ProjectConfig = {
      ...validConfig,
      recipes: ['prisma', 'typeorm-postgres', 'pino', 'winston'],
    };
    const validationResult = validateConfig(config);
    expect(validationResult.success).toBe(false);
    if (!validationResult.success) {
      expect(validationResult.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('conflicts with'),
          }),
        ]),
      );
    }

    // Step 2: conflict-detector still independently catches both conflicts
    const conflicts = detectConflicts(config.recipes, allRecipes);
    const mutualExclusions = conflicts.filter((c) => c.type === 'mutual-exclusion');
    expect(mutualExclusions.length).toBeGreaterThanOrEqual(2);
  });

  it('validateConfig and detectConflicts both catch missing requirements', () => {
    const config: ProjectConfig = {
      ...validConfig,
      recipes: ['auth-flows'],
    };
    // Step 1: validateConfig now catches missing requirements directly
    const validationResult = validateConfig(config);
    expect(validationResult.success).toBe(false);
    if (!validationResult.success) {
      expect(validationResult.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("requires 'jwt-auth'"),
          }),
        ]),
      );
    }

    // Step 2: conflict-detector still independently catches the missing requirement
    const conflicts = detectConflicts(config.recipes, allRecipes);
    const missing = conflicts.filter((c) => c.type === 'missing-requirement');
    expect(missing.length).toBeGreaterThanOrEqual(1);
    expect(missing[0].recipes).toContain('jwt-auth');
  });

  it('httpAdapter defaults to fastify when not provided', () => {
    const configWithoutAdapter = { ...validConfig } as Record<string, unknown>;
    delete configWithoutAdapter['httpAdapter'];
    const result = validateConfig(configWithoutAdapter as unknown as ProjectConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.httpAdapter).toBe('fastify');
    }
  });
});
