import { findDependents } from '@spoonfeed/utils/dependency-checker';
import type { RecipeDefinition, RecipeId } from '@spoonfeed/types';

function makeRecipe(overrides: Partial<RecipeDefinition> & { id: RecipeId }): RecipeDefinition {
  return {
    name: overrides.id,
    description: '',
    category: 'test',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: overrides.id,
    claudeMdSection: '',
    cursorRules: '',
    copilotInstructions: '',
    ...overrides,
  };
}

describe('dependency-checker', () => {
  it('should return empty array when no recipes depend on the target', () => {
    const recipes: RecipeDefinition[] = [makeRecipe({ id: 'swagger' }), makeRecipe({ id: 'pino' })];

    const result = findDependents('swagger', ['swagger', 'pino'], recipes);
    expect(result).toEqual([]);
  });

  it('should return dependents when another recipe requires the target', () => {
    const recipes: RecipeDefinition[] = [
      makeRecipe({ id: 'jwt-auth' }),
      makeRecipe({ id: 'rbac-casl', requires: ['jwt-auth'] }),
    ];

    const result = findDependents('jwt-auth', ['jwt-auth', 'rbac-casl'], recipes);
    expect(result).toEqual([{ recipeId: 'rbac-casl', recipeName: 'rbac-casl' }]);
  });

  it('should return multiple dependents', () => {
    const recipes: RecipeDefinition[] = [
      makeRecipe({ id: 'jwt-auth' }),
      makeRecipe({ id: 'rbac-casl', requires: ['jwt-auth'] }),
      makeRecipe({ id: 'api-keys', requires: ['jwt-auth'] }),
    ];

    const result = findDependents('jwt-auth', ['jwt-auth', 'rbac-casl', 'api-keys'], recipes);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.recipeId)).toContain('rbac-casl');
    expect(result.map((d) => d.recipeId)).toContain('api-keys');
  });

  it('should only check installed recipes, not all recipes', () => {
    const recipes: RecipeDefinition[] = [
      makeRecipe({ id: 'jwt-auth' }),
      makeRecipe({ id: 'rbac-casl', requires: ['jwt-auth'] }),
    ];

    // rbac-casl is NOT installed, so it should not appear as a dependent
    const result = findDependents('jwt-auth', ['jwt-auth'], recipes);
    expect(result).toEqual([]);
  });

  it('should not list the target recipe itself as a dependent', () => {
    const recipes: RecipeDefinition[] = [makeRecipe({ id: 'jwt-auth', requires: [] })];

    const result = findDependents('jwt-auth', ['jwt-auth'], recipes);
    expect(result).toEqual([]);
  });
});
