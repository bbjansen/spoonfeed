import { Tree, logger } from '@nx/devkit';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';
import type { RecipeId } from '../../types.js';
import type { SpoonfeederManifest } from '../../utils/recipe-manifest.js';
import type { ListRecipesGeneratorSchema } from './schema.js';

export default function listRecipesGenerator(
  tree: Tree,
  options: ListRecipesGeneratorSchema,
): void {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);

  // Read manifest
  const manifestPath = '.spoonfeeder.json';
  const manifest = tree.exists(manifestPath)
    ? (JSON.parse(tree.read(manifestPath, 'utf-8')!) as SpoonfeederManifest)
    : null;

  const installedIds = manifest ? Object.keys(manifest.recipes) : [];
  const allRecipes = options.category
    ? registry.getByCategory(options.category)
    : registry.getAll();

  if (options.json) {
    const output = {
      projectType: manifest?.projectType ?? 'unknown',
      cloudProvider: manifest?.cloudProvider ?? 'unknown',
      installed: installedIds,
      available: allRecipes
        .filter((r) => !installedIds.includes(r.id))
        .map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          conflicts: r.conflicts,
        })),
    };
    logger.info(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  if (manifest) {
    logger.info(`\nProject: ${manifest.projectType} (${manifest.cloudProvider})\n`);
  }

  if (installedIds.length > 0) {
    logger.info(`Installed (${installedIds.length}):`);
    for (const id of installedIds) {
      const recipe = registry.get(id as RecipeId);
      logger.info(`  ${id.padEnd(25)} ${recipe?.description ?? ''}`);
    }
    logger.info('');
  }

  const available = allRecipes.filter((r) => !installedIds.includes(r.id));
  logger.info(`Available (${available.length}):`);
  for (const recipe of available.slice(0, 20)) {
    const conflictNote = recipe.conflicts.some((c) => installedIds.includes(c))
      ? ` (conflicts: ${recipe.conflicts.filter((c) => installedIds.includes(c)).join(', ')})`
      : '';
    logger.info(`  ${recipe.id.padEnd(25)} ${recipe.description}${conflictNote}`);
  }

  if (available.length > 20) {
    logger.info(`  ... and ${available.length - 20} more`);
  }

  logger.info('\nUse: nx g spoonfeeder:add <recipe>');
}
