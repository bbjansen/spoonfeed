import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { Tree, updateJson, formatFiles, logger } from '@nx/devkit';
import type { RemoveRecipeGeneratorSchema } from './schema.js';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';
import { findDependents } from '../../utils/dependency-checker.js';
import type { RecipeId, RecipeDefinition } from '../../types.js';
import type { SpoonfeedManifest } from '../../utils/recipe-manifest.js';
import { removeModuleImportFromString } from '../../utils/module-updater.js';
import { removeBlockFromString } from '../../utils/main-ts-updater.js';

const generatorDir = path.dirname(fileURLToPath(import.meta.url));

interface PackageFragment {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageJson {
  scripts?: Record<string, string>;
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
  const manifestPath = '.spoonfeed.json';
  if (!tree.exists(manifestPath)) {
    throw new Error('.spoonfeed.json not found. Is this a spoonfeed-generated project?');
  }

  const manifest = JSON.parse(tree.read(manifestPath, 'utf-8')!) as SpoonfeedManifest;
  const httpAdapter = manifest.httpAdapter ?? 'fastify';
  const isExpress = httpAdapter === 'express';
  const recipeEntry = manifest.recipes[recipeId];

  // Workspace-aware source paths
  const isWorkspace = manifest.projectType === 'full-stack' || manifest.projectType === 'monorepo';
  const srcPrefix = isWorkspace ? 'apps/api/src' : 'src';

  if (!recipeEntry) {
    throw new Error(
      `Recipe '${recipeId}' is not installed. Run 'nx g spoonfeed:list' to see installed recipes.`,
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
    const depsToRemove = Object.keys(
      isExpress && recipeDef.expressDependencies
        ? recipeDef.expressDependencies
        : recipeDef.dependencies,
    );
    const devDepsToRemove = Object.keys(recipeDef.devDependencies);

    if (depsToRemove.length > 0 || devDepsToRemove.length > 0) {
      // Build a set of deps used by OTHER installed recipes so we don't remove shared deps
      const otherRecipeIds = installedIds.filter((id) => id !== recipeId);
      const sharedDeps = new Set<string>();
      for (const otherId of otherRecipeIds) {
        const otherDef = registry.get(otherId as RecipeId);
        if (!otherDef) continue;
        for (const dep of Object.keys(
          isExpress && otherDef.expressDependencies
            ? otherDef.expressDependencies
            : otherDef.dependencies,
        )) sharedDeps.add(dep);
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

  // 4a. Remove package-fragment.json scripts (and extra deps) from package.json
  if (recipeDef?.templateDir) {
    const templatesDir = path.resolve(generatorDir, '..', '..', '..', 'templates');
    const fragmentPath = path.join(templatesDir, 'recipes', recipeDef.templateDir, 'package-fragment.json');
    if (await fs.pathExists(fragmentPath)) {
      const fragment: PackageFragment = await fs.readJson(fragmentPath);

      // Build set of script keys contributed by OTHER installed recipes' fragments
      const otherRecipeIds = installedIds.filter((id) => id !== recipeId);
      const sharedScriptKeys = new Set<string>();
      for (const otherId of otherRecipeIds) {
        const otherDef = registry.get(otherId as RecipeId);
        if (!otherDef?.templateDir) continue;
        const otherFragPath = path.join(templatesDir, 'recipes', otherDef.templateDir, 'package-fragment.json');
        if (await fs.pathExists(otherFragPath)) {
          const otherFrag: PackageFragment = await fs.readJson(otherFragPath);
          if (otherFrag.scripts) {
            for (const key of Object.keys(otherFrag.scripts)) sharedScriptKeys.add(key);
          }
        }
      }

      // Build set of deps used by OTHER installed recipes so we don't remove shared deps
      const sharedFragDeps = new Set<string>();
      for (const otherId of otherRecipeIds) {
        const otherDef = registry.get(otherId as RecipeId);
        if (!otherDef) continue;
        for (const dep of Object.keys(
          isExpress && otherDef.expressDependencies
            ? otherDef.expressDependencies
            : otherDef.dependencies,
        )) sharedFragDeps.add(dep);
        for (const dep of Object.keys(otherDef.devDependencies)) sharedFragDeps.add(dep);
      }

      updateJson<PackageJson>(tree, 'package.json', (json) => {
        if (fragment.scripts) {
          for (const key of Object.keys(fragment.scripts)) {
            if (!sharedScriptKeys.has(key)) {
              delete json.scripts?.[key];
            }
          }
        }
        if (fragment.dependencies) {
          for (const dep of Object.keys(fragment.dependencies)) {
            if (!sharedFragDeps.has(dep)) {
              delete json.dependencies?.[dep];
            }
          }
        }
        if (fragment.devDependencies) {
          for (const dep of Object.keys(fragment.devDependencies)) {
            if (!sharedFragDeps.has(dep)) {
              delete json.devDependencies?.[dep];
            }
          }
        }
        return json;
      });
      logger.info(`  Removed package-fragment.json entries for '${recipeId}'`);
    }
  }

  // 5. Remove module import from app.module.ts
  if (recipeEntry.moduleImport) {
    const appModulePath = `${srcPrefix}/app.module.ts`;
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

  // 6. Remove main.ts blocks and their imports
  if (recipeEntry.mainTsBlocks && recipeEntry.mainTsBlocks.length > 0) {
    const mainTsPath = `${srcPrefix}/main.ts`;
    if (tree.exists(mainTsPath)) {
      let mainContent = tree.read(mainTsPath, 'utf-8')!;

      // Collect import module specifiers from the recipe definition
      const activeSetup = isExpress && recipeDef?.expressMainTsSetup
        ? recipeDef.expressMainTsSetup
        : recipeDef?.mainTsSetup;
      const importSpecifiers = activeSetup?.block?.imports?.map(
        (imp: { moduleSpecifier: string }) => imp.moduleSpecifier,
      ) ?? [];

      // Build set of specifiers still needed by other installed recipes
      const otherSpecifiers = new Set<string>();
      for (const otherId of Object.keys(manifest.recipes)) {
        if (otherId === recipeId) continue;
        const otherEntry = manifest.recipes[otherId];
        if (!otherEntry.mainTsBlocks?.length) continue;
        const otherDef = registry.get(otherId as RecipeId);
        if (!otherDef) continue;
        const otherSetup = isExpress && otherDef.expressMainTsSetup
          ? otherDef.expressMainTsSetup
          : otherDef.mainTsSetup;
        for (const imp of otherSetup?.block?.imports ?? []) {
          otherSpecifiers.add(imp.moduleSpecifier);
        }
      }

      // Filter out specifiers still needed by other recipes
      const safeSpecifiers = importSpecifiers.filter(
        (s: string) => !otherSpecifiers.has(s),
      );

      for (const blockId of recipeEntry.mainTsBlocks) {
        mainContent = removeBlockFromString(mainContent, blockId, safeSpecifiers);
        logger.info(`  Removed main.ts block: ${blockId}`);
      }

      tree.write(mainTsPath, mainContent);
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

        // Promote shared vars that referenced this section back to active lines
        const removedSectionName = recipeEntry.envSection;
        const sharedVarRegex = new RegExp(
          `^# (\\S+=\\S+) \\(shared with ${escapeRegexString(removedSectionName)}\\)$`,
          'gm',
        );
        content = content.replace(sharedVarRegex, '$1');

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
  updateJson<SpoonfeedManifest>(tree, manifestPath, (json) => {
    delete json.recipes[recipeId];
    return json;
  });

  await formatFiles(tree);

  logger.info(`\nRecipe '${recipeId}' removed successfully.`);
  logger.info('Run `pnpm install` to clean up the lockfile.');
}

/**
 * Removes a delimited AI context section from a markdown file.
 * Sections are wrapped in <!-- @spoonfeed:<id> --> / <!-- @spoonfeed:end:<id> --> markers.
 */
function removeAiContextSection(tree: Tree, filePath: string, recipeId: string): void {
  if (!tree.exists(filePath)) return;

  let content = tree.read(filePath, 'utf-8')!;
  const startMarker = `<!-- @spoonfeed:${recipeId} -->`;
  const endMarker = `<!-- @spoonfeed:end:${recipeId} -->`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
  content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  tree.write(filePath, content);
  logger.info(`  Removed AI context section from: ${filePath}`);
}

/**
 * Escapes special regex characters in a string so it can be used in a RegExp constructor.
 */
function escapeRegexString(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
