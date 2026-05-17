import type { RecipeId, RecipeDefinition } from '../types.js';

export interface Conflict {
  type: 'mutual-exclusion' | 'missing-requirement';
  recipes: RecipeId[];
  message: string;
}

export function detectConflicts(
  selectedIds: RecipeId[],
  allRecipes: RecipeDefinition[] = [],
): Conflict[] {
  const conflicts: Conflict[] = [];
  const selectedSet = new Set(selectedIds);
  const recipeMap = new Map(allRecipes.map((r) => [r.id, r]));

  // Check mutual exclusions
  for (const id of selectedIds) {
    const recipe = recipeMap.get(id);
    if (!recipe) continue;

    for (const conflictId of recipe.conflicts) {
      if (selectedSet.has(conflictId) && id < conflictId) {
        conflicts.push({
          type: 'mutual-exclusion',
          recipes: [id, conflictId],
          message: `${recipe.name} conflicts with ${recipeMap.get(conflictId)?.name ?? conflictId}`,
        });
      }
    }
  }

  // Check missing requirements
  for (const id of selectedIds) {
    const recipe = recipeMap.get(id);
    if (!recipe) continue;

    for (const reqId of recipe.requires) {
      if (!selectedSet.has(reqId)) {
        conflicts.push({
          type: 'missing-requirement',
          recipes: [id, reqId],
          message: `${recipe.name} requires ${recipeMap.get(reqId)?.name ?? reqId}`,
        });
      }
    }
  }

  return conflicts;
}
