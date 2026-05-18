import * as fs from 'node:fs';
import * as path from 'node:path';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { PROJECT_TYPES } from '@spoonfeed/types';
import type { RecipeDefinition } from '@spoonfeed/types';

// Suppress @clack/prompts spinner output in tests (import tree may pull it in)
jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

describe('Recipe definition invariants', () => {
  let recipes: RecipeDefinition[];
  let recipeIds: Set<string>;

  beforeAll(() => {
    const registry = createRegistry();
    recipes = registry.getAll();
    recipeIds = new Set(recipes.map((r) => r.id));
  });

  it('every recipe with @fastify/* in dependencies should have expressDependencies', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      const hasFastifyDep = Object.keys(recipe.dependencies).some((key) =>
        key.startsWith('@fastify/'),
      );

      if (hasFastifyDep && !recipe.expressDependencies) {
        violations.push(recipe.id);
      }
    }

    expect(violations).toEqual(
      expect.arrayContaining([]),
    );
    if (violations.length > 0) {
      fail(
        `Recipes with @fastify/* dependencies but no expressDependencies: ${violations.join(', ')}`,
      );
    }
  });

  it('expressDependencies should not contain @fastify/* packages', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (!recipe.expressDependencies) continue;

      const fastifyKeys = Object.keys(recipe.expressDependencies).filter((key) =>
        key.startsWith('@fastify/'),
      );

      if (fastifyKeys.length > 0) {
        violations.push(`${recipe.id} (${fastifyKeys.join(', ')})`);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes with @fastify/* packages in expressDependencies: ${violations.join('; ')}`,
      );
    }
  });

  it('every mainTsSetup using app.register() should have expressMainTsSetup', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (!recipe.mainTsSetup) continue;

      const usesAppRegister = recipe.mainTsSetup.block.code.includes('app.register(');

      if (usesAppRegister && !recipe.expressMainTsSetup) {
        violations.push(recipe.id);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes with app.register() in mainTsSetup but no expressMainTsSetup: ${violations.join(', ')}`,
      );
    }
  });

  it('expressMainTsSetup should not import from @fastify/* or use app.register()', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (!recipe.expressMainTsSetup) continue;

      const block = recipe.expressMainTsSetup.block;
      const problems: string[] = [];

      const hasFastifyImport = block.imports.some((imp) =>
        imp.moduleSpecifier.startsWith('@fastify/'),
      );
      if (hasFastifyImport) {
        problems.push('imports from @fastify/*');
      }

      if (block.code.includes('app.register(')) {
        problems.push('uses app.register()');
      }

      if (problems.length > 0) {
        violations.push(`${recipe.id} (${problems.join(', ')})`);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes with invalid expressMainTsSetup: ${violations.join('; ')}`,
      );
    }
  });

  it('every templateDir should exist on disk', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (!recipe.templateDir) continue;

      const dirPath = path.join(TEMPLATES_DIR, 'recipes', recipe.templateDir);
      if (!fs.existsSync(dirPath)) {
        violations.push(`${recipe.id} (expected: ${dirPath})`);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes with missing templateDir on disk: ${violations.join('; ')}`,
      );
    }
  });

  it('compatibleWith should only contain valid project types', () => {
    const validTypes = new Set<string>(PROJECT_TYPES);
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (recipe.compatibleWith === 'all') continue;

      const invalidTypes = recipe.compatibleWith.filter((t) => !validTypes.has(t));
      if (invalidTypes.length > 0) {
        violations.push(`${recipe.id} (invalid: ${invalidTypes.join(', ')})`);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes with invalid compatibleWith project types: ${violations.join('; ')}`,
      );
    }
  });

  it('all conflict targets should exist as recipe IDs', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      const invalidConflicts = recipe.conflicts.filter((c) => !recipeIds.has(c));
      if (invalidConflicts.length > 0) {
        violations.push(`${recipe.id} (unknown conflicts: ${invalidConflicts.join(', ')})`);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes with conflict targets that do not exist: ${violations.join('; ')}`,
      );
    }
  });

  it('all requires targets should exist as recipe IDs', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      const invalidRequires = recipe.requires.filter((r) => !recipeIds.has(r));
      if (invalidRequires.length > 0) {
        violations.push(`${recipe.id} (unknown requires: ${invalidRequires.join(', ')})`);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes with requires targets that do not exist: ${violations.join('; ')}`,
      );
    }
  });

  it('no recipe should conflict with itself', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (recipe.conflicts.includes(recipe.id)) {
        violations.push(recipe.id);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes that conflict with themselves: ${violations.join(', ')}`,
      );
    }
  });

  it('no recipe should require itself', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (recipe.requires.includes(recipe.id)) {
        violations.push(recipe.id);
      }
    }

    if (violations.length > 0) {
      fail(
        `Recipes that require themselves: ${violations.join(', ')}`,
      );
    }
  });

  it('recipe IDs should be unique', () => {
    const seen = new Map<string, number>();

    for (const recipe of recipes) {
      seen.set(recipe.id, (seen.get(recipe.id) ?? 0) + 1);
    }

    const duplicates = [...seen.entries()]
      .filter(([, count]) => count > 1)
      .map(([id, count]) => `${id} (${count} times)`);

    if (duplicates.length > 0) {
      fail(
        `Duplicate recipe IDs: ${duplicates.join(', ')}`,
      );
    }
  });
});
