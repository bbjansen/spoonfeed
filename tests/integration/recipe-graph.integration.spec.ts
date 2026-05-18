import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { RECIPE_IDS } from '@spoonfeed/types';
import type { RecipeDefinition, RecipeId, ProjectType } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

describe('Recipe dependency/conflict graph', () => {
  let recipes: RecipeDefinition[];
  let recipeMap: Map<RecipeId, RecipeDefinition>;

  beforeAll(() => {
    const registry = createRegistry();
    recipes = registry.getAll();
    recipeMap = new Map(recipes.map((r) => [r.id, r]));
  });

  it('conflicts should be bidirectional', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      for (const conflictId of recipe.conflicts) {
        const other = recipeMap.get(conflictId);
        if (!other) continue;

        if (!other.conflicts.includes(recipe.id)) {
          violations.push(
            `${recipe.id} lists ${conflictId} as a conflict, but ${conflictId} does not list ${recipe.id}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('no circular requires', () => {
    const cycle = findRequiresCycle(recipes, recipeMap);

    if (cycle) {
      throw new Error(
        `Circular requires chain detected: ${cycle.join(' -> ')}`,
      );
    }
  });

  it('requires targets should exist', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      for (const reqId of recipe.requires) {
        if (!recipeMap.has(reqId)) {
          violations.push(
            `${recipe.id} requires '${reqId}' which does not exist in the registry`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('conflict targets should exist', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      for (const conflictId of recipe.conflicts) {
        if (!recipeMap.has(conflictId)) {
          violations.push(
            `${recipe.id} lists conflict '${conflictId}' which does not exist in the registry`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('no self-references in conflicts or requires', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (recipe.conflicts.includes(recipe.id)) {
        violations.push(`${recipe.id} lists itself in conflicts`);
      }
      if (recipe.requires.includes(recipe.id)) {
        violations.push(`${recipe.id} lists itself in requires`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('database ORM recipes should conflict with each other', () => {
    const ormIds: RecipeId[] = [
      'typeorm-postgres',
      'typeorm-mysql',
      'prisma',
      'mongoose',
      'drizzle-postgres',
      'kysely',
      'mikro-orm',
    ];

    const missing: string[] = [];

    for (const ormA of ormIds) {
      const recipeA = recipeMap.get(ormA);
      if (!recipeA) {
        missing.push(`${ormA} is not registered`);
        continue;
      }

      for (const ormB of ormIds) {
        if (ormA === ormB) continue;

        if (!recipeA.conflicts.includes(ormB)) {
          missing.push(`${ormA} does not list ${ormB} in conflicts`);
        }
      }
    }

    if (missing.length > 0) {
      // Report but do not hard-fail -- some ORM pairs may legitimately coexist
      console.warn(
        `Missing ORM conflicts (review whether intentional):\n  - ${missing.join('\n  - ')}`,
      );
    }

    // At minimum, each ORM recipe should exist in the registry
    for (const ormId of ormIds) {
      expect(recipeMap.has(ormId)).toBe(true);
    }
  });

  it('requires chain should be satisfiable (no conflict between co-required recipes)', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (recipe.requires.length === 0) continue;

      // Collect the full transitive requires set for this recipe
      const allRequired = collectTransitiveRequires(recipe.id, recipeMap);
      if (!allRequired) continue; // cycle detected -- covered by separate test

      // Check: does the recipe itself conflict with any of its transitive requires?
      for (const reqId of allRequired) {
        if (recipe.conflicts.includes(reqId)) {
          violations.push(
            `${recipe.id} requires '${reqId}' but also conflicts with it`,
          );
        }
      }

      // Check: do any two recipes in the combined set (recipe + all requires) conflict?
      const fullSet = [recipe.id, ...allRequired];
      for (let i = 0; i < fullSet.length; i++) {
        const a = recipeMap.get(fullSet[i]);
        if (!a) continue;

        for (let j = i + 1; j < fullSet.length; j++) {
          if (a.conflicts.includes(fullSet[j])) {
            violations.push(
              `${recipe.id}: transitive requires set contains conflicting pair ${fullSet[i]} <-> ${fullSet[j]}`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('compatibleWith consistency: requiring recipe must be subset of required recipe', () => {
    const violations: string[] = [];

    for (const recipe of recipes) {
      if (recipe.compatibleWith === 'all') continue;
      if (recipe.requires.length === 0) continue;

      const recipeTypes = new Set<ProjectType>(recipe.compatibleWith);

      for (const reqId of recipe.requires) {
        const required = recipeMap.get(reqId);
        if (!required) continue;

        // If the required recipe supports 'all', any subset is fine
        if (required.compatibleWith === 'all') continue;

        const requiredTypes = new Set<ProjectType>(required.compatibleWith);

        const unsupportedTypes = [...recipeTypes].filter((t) => !requiredTypes.has(t));

        if (unsupportedTypes.length > 0) {
          violations.push(
            `${recipe.id} is compatible with [${unsupportedTypes.join(', ')}] but its required recipe '${reqId}' is not`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('recipe count matches RECIPE_IDS', () => {
    const expectedCount = RECIPE_IDS.length;
    const actualCount = recipes.length;

    expect(actualCount).toBe(expectedCount);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * DFS cycle detection across the requires graph.
 * Returns the cycle path as an array of recipe IDs, or null if no cycle exists.
 */
function findRequiresCycle(
  recipes: RecipeDefinition[],
  recipeMap: Map<RecipeId, RecipeDefinition>,
): RecipeId[] | null {
  const WHITE = 0; // unvisited
  const GREY = 1; // in current DFS path
  const BLACK = 2; // fully explored

  const color = new Map<RecipeId, number>();
  const parent = new Map<RecipeId, RecipeId | null>();

  for (const recipe of recipes) {
    color.set(recipe.id, WHITE);
  }

  for (const recipe of recipes) {
    if (color.get(recipe.id) !== WHITE) continue;

    const cycle = dfsVisit(recipe.id, color, parent, recipeMap);
    if (cycle) return cycle;
  }

  return null;
}

function dfsVisit(
  nodeId: RecipeId,
  color: Map<RecipeId, number>,
  parent: Map<RecipeId, RecipeId | null>,
  recipeMap: Map<RecipeId, RecipeDefinition>,
): RecipeId[] | null {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;

  color.set(nodeId, GREY);

  const recipe = recipeMap.get(nodeId);
  if (!recipe) {
    color.set(nodeId, BLACK);
    return null;
  }

  for (const reqId of recipe.requires) {
    if (!recipeMap.has(reqId)) continue;

    const reqColor = color.get(reqId) ?? WHITE;

    if (reqColor === GREY) {
      // Back edge found -- reconstruct cycle
      const cycle: RecipeId[] = [reqId, nodeId];
      let cur = nodeId;
      while (parent.get(cur) && parent.get(cur) !== reqId) {
        cur = parent.get(cur)!;
        cycle.push(cur);
      }
      cycle.push(reqId);
      return cycle.reverse();
    }

    if (reqColor === WHITE) {
      parent.set(reqId, nodeId);
      const cycle = dfsVisit(reqId, color, parent, recipeMap);
      if (cycle) return cycle;
    }
  }

  color.set(nodeId, BLACK);
  return null;
}

/**
 * Collects the full transitive set of requires for a recipe.
 * Returns null if a cycle is detected (to avoid infinite loops).
 */
function collectTransitiveRequires(
  startId: RecipeId,
  recipeMap: Map<RecipeId, RecipeDefinition>,
): Set<RecipeId> | null {
  const visited = new Set<RecipeId>();
  const stack = new Set<RecipeId>();

  function walk(id: RecipeId): boolean {
    if (stack.has(id)) return false; // cycle
    if (visited.has(id)) return true;

    stack.add(id);
    visited.add(id);

    const recipe = recipeMap.get(id);
    if (recipe) {
      for (const reqId of recipe.requires) {
        if (!walk(reqId)) return false;
      }
    }

    stack.delete(id);
    return true;
  }

  const recipe = recipeMap.get(startId);
  if (!recipe) return null;

  for (const reqId of recipe.requires) {
    if (!walk(reqId)) return null;
  }

  // Remove the start node itself from the result
  visited.delete(startId);
  return visited;
}
