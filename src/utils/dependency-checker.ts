import type { RecipeDefinition, RecipeId } from '../types.js';

export interface Dependent {
  recipeId: RecipeId;
  recipeName: string;
}

/**
 * Finds all installed recipes that depend on the given target recipe via their `requires` field.
 *
 * @param targetId - The recipe ID being considered for removal
 * @param installedIds - All currently installed recipe IDs
 * @param allRecipes - Full recipe definitions (from registry) for the installed recipes
 * @returns Array of dependents — installed recipes that list `targetId` in their `requires`
 */
export function findDependents(
  targetId: RecipeId,
  installedIds: string[],
  allRecipes: RecipeDefinition[],
): Dependent[] {
  const recipeMap = new Map(allRecipes.map((r) => [r.id, r]));
  const dependents: Dependent[] = [];

  for (const id of installedIds) {
    if (id === targetId) continue;

    const recipe = recipeMap.get(id as RecipeId);
    if (!recipe) continue;

    if (recipe.requires.includes(targetId)) {
      dependents.push({
        recipeId: id as RecipeId,
        recipeName: recipe.name,
      });
    }
  }

  return dependents;
}
