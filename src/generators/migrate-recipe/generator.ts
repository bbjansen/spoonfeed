import { Tree, logger } from '@nx/devkit';
import type { MigrateRecipeGeneratorSchema } from './schema.js';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';
import type { RecipeDefinition, RecipeId } from '../../types.js';
import type { SpoonfeedManifest } from '../../utils/recipe-manifest.js';
import { findDependents } from '../../utils/dependency-checker.js';
import removeRecipeGenerator from '../remove-recipe/generator.js';
import addRecipeGenerator from '../add-recipe/generator.js';
import { getMigrationGuidance } from './migration-guidance.js';

export function validateMigrationPair(
  registry: RecipeRegistry,
  fromId: string,
  toId: string,
  installedRecipeIds: string[],
): { fromRecipe: RecipeDefinition; toRecipe: RecipeDefinition } {
  const fromRecipe = registry.get(fromId as RecipeId);
  if (!fromRecipe) {
    throw new Error(`Recipe '${fromId}' not found in the registry.`);
  }

  const toRecipe = registry.get(toId as RecipeId);
  if (!toRecipe) {
    throw new Error(`Recipe '${toId}' not found in the registry.`);
  }

  if (fromId === toId) {
    throw new Error('Cannot migrate a recipe to itself.');
  }

  if (!installedRecipeIds.includes(fromId)) {
    throw new Error(
      `Recipe '${fromId}' is not installed. Cannot migrate from a recipe that is not present.`,
    );
  }

  if (installedRecipeIds.includes(toId)) {
    throw new Error(
      `Recipe '${toId}' is already installed. Cannot migrate to a recipe that is already present.`,
    );
  }

  if (fromRecipe.category !== toRecipe.category) {
    throw new Error(
      `Cannot migrate between different categories: '${fromRecipe.name}' is in '${fromRecipe.category}' but '${toRecipe.name}' is in '${toRecipe.category}'. Migration is only allowed within the same category.`,
    );
  }

  return { fromRecipe, toRecipe };
}

export default async function migrateRecipeGenerator(
  tree: Tree,
  options: MigrateRecipeGeneratorSchema,
): Promise<void> {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);

  // Read manifest
  const manifestPath = '.spoonfeed.json';
  if (!tree.exists(manifestPath)) {
    throw new Error('.spoonfeed.json not found. Is this a spoonfeed-generated project?');
  }

  const manifest = JSON.parse(tree.read(manifestPath, 'utf-8')!) as SpoonfeedManifest;

  const installedRecipeIds = Object.keys(manifest.recipes);

  // Validate the migration pair
  const { fromRecipe, toRecipe } = validateMigrationPair(
    registry,
    options.from,
    options.to,
    installedRecipeIds,
  );

  // Check if any installed recipes depend on the 'from' recipe
  const allInstalledRecipes = installedRecipeIds
    .map((id) => registry.get(id as RecipeId))
    .filter(Boolean) as RecipeDefinition[];

  const dependents = findDependents(
    options.from as RecipeId,
    installedRecipeIds,
    allInstalledRecipes,
  );

  if (dependents.length > 0) {
    // Check if the 'to' recipe satisfies the dependency (i.e. dependents require 'from' but 'to' could replace it)
    const toRecipeId = options.to as RecipeId;
    const unsatisfiedDependents = dependents.filter((dep) => {
      const depRecipe = registry.get(dep.recipeId);
      // The dependent is unsatisfied if it requires the 'from' recipe and the 'to' recipe does not satisfy it
      return !depRecipe?.requires.includes(toRecipeId);
    });

    if (unsatisfiedDependents.length > 0) {
      const names = unsatisfiedDependents.map((d) => `'${d.recipeName}' (${d.recipeId})`).join(', ');
      throw new Error(
        `Cannot migrate from '${options.from}' to '${options.to}': the following installed recipes depend on '${options.from}': ${names}. Remove or migrate those recipes first.`,
      );
    }
  }

  logger.info(`Migrating from '${fromRecipe.name}' to '${toRecipe.name}'...`);
  logger.info('');

  // Step 1: Remove the old recipe
  logger.info(`Step 1/2: Removing '${fromRecipe.name}'...`);
  await removeRecipeGenerator(tree, {
    recipe: options.from,
    force: true,
  });

  // Step 2: Add the new recipe
  logger.info(`Step 2/2: Adding '${toRecipe.name}'...`);
  await addRecipeGenerator(tree, {
    recipe: options.to,
    skipInstall: false,
  });

  // Step 3: Print migration guidance
  logger.info('');
  logger.info('\u2501'.repeat(70));
  logger.info('  MIGRATION GUIDANCE');
  logger.info('\u2501'.repeat(70));
  logger.info('');

  const guidance = getMigrationGuidance(options.from, options.to, fromRecipe.category);
  for (const line of guidance) {
    logger.info(`  ${line}`);
  }

  logger.info('');
  logger.info('\u2501'.repeat(70));
  logger.info('');

  logger.info(`Migration from '${fromRecipe.name}' to '${toRecipe.name}' complete.`);
}
