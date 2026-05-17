import * as p from '@clack/prompts';
import type { RecipeId } from '../types.js';
import type { RecipeDefinition } from '../recipes/recipe.interface.js';
import { detectConflicts } from '../validation/conflict-detector.js';

export async function promptAddOns(
  availableRecipes: RecipeDefinition[],
  smartDefaults: RecipeId[],
): Promise<RecipeId[]> {
  const options = availableRecipes.map((r) => ({
    value: r.id as string,
    label: r.name,
    hint: r.description,
  }));

  const result = await p.multiselect({
    message: 'Select add-ons:',
    options,
    initialValues: smartDefaults as string[],
    required: false,
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const selected = result as RecipeId[];

  const conflicts = detectConflicts(selected, availableRecipes);
  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      p.log.warning(`Conflict: ${conflict.recipes.join(' vs ')} — ${conflict.message}`);
    }
    return promptAddOns(availableRecipes, selected);
  }

  return selected;
}
