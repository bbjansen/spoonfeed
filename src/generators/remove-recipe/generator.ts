import { Tree, updateJson, formatFiles, logger } from '@nx/devkit';
import type { RemoveRecipeGeneratorSchema } from './schema.js';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';
import { findDependents } from '../../utils/dependency-checker.js';
import type { RecipeId, RecipeDefinition } from '../../types.js';
import type { SpoonfeederManifest } from '../../utils/recipe-manifest.js';
import { removeModuleImportFromString } from '../../utils/module-updater.js';

interface PackageJson {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  [key: string]: unknown;
}

export default async function removeRecipeGenerator(
  tree: Tree,
  options: RemoveRecipeGeneratorSchema,
): Promise<void> {
  const recipeId = options.recipe as RecipeId;

  // 1. Read manifest and confirm recipe is installed
  const manifestPath = '.spoonfeeder.json';
  if (!tree.exists(manifestPath)) {
    throw new Error('.spoonfeeder.json not found. Is this a spoonfeeder-generated project?');
  }

  const manifest = JSON.parse(tree.read(manifestPath, 'utf-8')!) as SpoonfeederManifest;
  const recipeEntry = manifest.recipes[recipeId];

  if (!recipeEntry) {
    throw new Error(
      `Recipe '${recipeId}' is not installed. Run 'nx g spoonfeeder:list' to see installed recipes.`,
    );
  }

  // 2. Check that no other installed recipe depends on this one
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);

  const installedIds = Object.keys(manifest.recipes);
  const installedRecipes = installedIds
    .map((id) => registry.get(id as RecipeId))
    .filter(Boolean) as RecipeDefinition[];

  const dependents = findDependents(recipeId, installedIds, installedRecipes);

  if (dependents.length > 0 && !options.force) {
    const dependentNames = dependents.map((d) => `'${d.recipeName}' (${d.recipeId})`).join(', ');
    throw new Error(
      `Cannot remove '${recipeId}': the following installed recipes depend on it: ${dependentNames}. ` +
        `Use --force to remove anyway.`,
    );
  }

  // Look up the recipe definition for dependency metadata
  const recipeDef = registry.get(recipeId);

  // 3. Remove recipe-specific files listed in the manifest
  for (const filePath of recipeEntry.files) {
    if (tree.exists(filePath)) {
      tree.delete(filePath);
      logger.info(`  Deleted: ${filePath}`);
    }
  }

  // Clean up empty directories left behind by deleted files
  cleanEmptyDirectories(tree, recipeEntry.files);

  // 4. Remove dependencies and devDependencies from package.json
  if (recipeDef) {
    const depsToRemove = Object.keys(recipeDef.dependencies);
    const devDepsToRemove = Object.keys(recipeDef.devDependencies);

    if (depsToRemove.length > 0 || devDepsToRemove.length > 0) {
      // Build a set of deps used by OTHER installed recipes so we don't remove shared deps
      const otherRecipeIds = installedIds.filter((id) => id !== recipeId);
      const sharedDeps = new Set<string>();
      for (const otherId of otherRecipeIds) {
        const otherDef = registry.get(otherId as RecipeId);
        if (!otherDef) continue;
        for (const dep of Object.keys(otherDef.dependencies)) sharedDeps.add(dep);
        for (const dep of Object.keys(otherDef.devDependencies)) sharedDeps.add(dep);
      }

      updateJson<PackageJson>(tree, 'package.json', (json) => {
        for (const dep of depsToRemove) {
          if (!sharedDeps.has(dep)) {
            delete json.dependencies?.[dep];
          }
        }
        for (const dep of devDepsToRemove) {
          if (!sharedDeps.has(dep)) {
            delete json.devDependencies?.[dep];
          }
        }
        return json;
      });
    }
  }

  // 5. Remove module import from app.module.ts
  if (recipeEntry.moduleImport) {
    const appModulePath = 'src/app.module.ts';
    if (tree.exists(appModulePath)) {
      const content = tree.read(appModulePath, 'utf-8')!;
      const transformed = removeModuleImportFromString(
        content,
        recipeEntry.moduleImport.moduleName,
        recipeEntry.moduleImport.importPath,
      );
      tree.write(appModulePath, transformed);
      logger.info(`  Removed import: ${recipeEntry.moduleImport.moduleName} from app.module.ts`);
    }
  }

  // 6. Remove main.ts blocks
  if (recipeEntry.mainTsBlocks && recipeEntry.mainTsBlocks.length > 0) {
    const mainTsPath = 'src/main.ts';
    if (tree.exists(mainTsPath)) {
      for (const blockId of recipeEntry.mainTsBlocks) {
        removeMainTsBlockFromTree(tree, mainTsPath, blockId);
        logger.info(`  Removed main.ts block: ${blockId}`);
      }

      // Remove any imports that were added for the main.ts blocks.
      // These are tracked via comment markers: // @spoonfeeder-import:<recipe-id>
      const mainContent = tree.read(mainTsPath, 'utf-8')!;
      const importMarker = `// @spoonfeeder-import:${recipeId}`;
      if (mainContent.includes(importMarker)) {
        const lines = mainContent.split('\n');
        const filtered: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          // Check if the NEXT line is the marker — if so, skip the current line (the import)
          if (i + 1 < lines.length && lines[i + 1].includes(importMarker)) {
            continue;
          }
          // Skip the marker line itself
          if (lines[i].includes(importMarker)) {
            continue;
          }
          filtered.push(lines[i]);
        }

        tree.write(mainTsPath, filtered.join('\n'));
      }
    }
  }

  // 7. Remove env vars section from .env.example
  if (recipeEntry.envSection) {
    const envPath = '.env.example';
    if (tree.exists(envPath)) {
      let content = tree.read(envPath, 'utf-8')!;
      const startMarker = `# --- ${recipeEntry.envSection} ---`;
      const endMarker = `# --- end ${recipeEntry.envSection} ---`;

      const startIdx = content.indexOf(startMarker);
      const endIdx = content.indexOf(endMarker);

      if (startIdx !== -1 && endIdx !== -1) {
        content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
        content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
        tree.write(envPath, content);
        logger.info(`  Removed env section: ${recipeEntry.envSection}`);
      }
    }
  }

  // 8. Remove AI context sections
  removeAiContextSection(tree, 'CLAUDE.md', recipeId);
  removeAiContextSection(tree, '.github/copilot-instructions.md', recipeId);

  // Remove cursor rules file (per-recipe .mdc file)
  const cursorRulePath = `.cursor/rules/${recipeId}.mdc`;
  if (tree.exists(cursorRulePath)) {
    tree.delete(cursorRulePath);
    logger.info(`  Deleted: ${cursorRulePath}`);
  }

  // 9. Update manifest to remove the recipe
  updateJson<SpoonfeederManifest>(tree, manifestPath, (json) => {
    delete json.recipes[recipeId];
    return json;
  });

  await formatFiles(tree);

  logger.info(`\nRecipe '${recipeId}' removed successfully.`);
  logger.info('Run `pnpm install` to clean up the lockfile.');
}

/**
 * Removes a delimited code block from main.ts via Tree.
 * Looks for `// --- <blockId> start ---` through `// --- <blockId> end ---`.
 */
function removeMainTsBlockFromTree(tree: Tree, filePath: string, blockId: string): void {
  let content = tree.read(filePath, 'utf-8')!;
  const startMarker = `// --- ${blockId} start ---`;
  const endMarker = `// --- ${blockId} end ---`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  // Find the start of the line containing the start marker
  let lineStart = startIdx;
  while (lineStart > 0 && content[lineStart - 1] !== '\n') {
    lineStart--;
  }

  // Find the end of the line containing the end marker
  let lineEnd = endIdx + endMarker.length;
  while (lineEnd < content.length && content[lineEnd] !== '\n') {
    lineEnd++;
  }
  // Include the trailing newline
  if (lineEnd < content.length && content[lineEnd] === '\n') {
    lineEnd++;
  }

  // Also remove any leading blank line before the block
  if (lineStart > 0 && content[lineStart - 1] === '\n') {
    lineStart--;
  }

  content = content.slice(0, lineStart) + content.slice(lineEnd);

  // Clean up multiple blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  tree.write(filePath, content);
}

/**
 * Removes a delimited AI context section from a markdown file.
 * Sections are wrapped in <!-- @spoonfeeder:<id> --> / <!-- @spoonfeeder:end:<id> --> markers.
 */
function removeAiContextSection(tree: Tree, filePath: string, recipeId: string): void {
  if (!tree.exists(filePath)) return;

  let content = tree.read(filePath, 'utf-8')!;
  const startMarker = `<!-- @spoonfeeder:${recipeId} -->`;
  const endMarker = `<!-- @spoonfeeder:end:${recipeId} -->`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
  content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  tree.write(filePath, content);
  logger.info(`  Removed AI context section from: ${filePath}`);
}

/**
 * Removes empty parent directories left behind after file deletion.
 * Walks up from each deleted file's directory and removes if empty.
 */
function cleanEmptyDirectories(tree: Tree, deletedFiles: string[]): void {
  const dirs = new Set<string>();

  for (const file of deletedFiles) {
    let dir = file.substring(0, file.lastIndexOf('/'));
    while (dir && dir !== '.' && dir !== 'src') {
      dirs.add(dir);
      dir = dir.substring(0, dir.lastIndexOf('/'));
    }
  }

  // Sort deepest first so children are cleaned before parents
  const sortedDirs = [...dirs].sort((a, b) => b.split('/').length - a.split('/').length);

  for (const dir of sortedDirs) {
    const children = tree.children(dir);
    if (children.length === 0) {
      tree.delete(dir);
      logger.info(`  Cleaned empty directory: ${dir}`);
    }
  }
}
