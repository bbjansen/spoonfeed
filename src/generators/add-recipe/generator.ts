import { Tree, formatFiles, updateJson, logger } from '@nx/devkit';
import type { AddRecipeGeneratorSchema } from './schema.js';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';
import { detectConflicts } from '../../validation/conflict-detector.js';
import type { ProjectType, RecipeDefinition, RecipeId } from '../../types.js';
import { addModuleImportToString } from '../../utils/module-updater.js';
import { insertBlockToString } from '../../utils/main-ts-updater.js';
import type { BlockDefinition } from '../../utils/main-ts-updater.js';
import type { SpoonfeederManifest } from '../../utils/recipe-manifest.js';

interface PackageJson {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  [key: string]: unknown;
}

export default async function addRecipeGenerator(
  tree: Tree,
  options: AddRecipeGeneratorSchema,
): Promise<void> {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);

  const recipeId = options.recipe as RecipeId;
  const recipe = registry.get(recipeId);

  if (!recipe) {
    throw new Error(
      `Recipe '${recipeId}' not found. Run 'nx g spoonfeeder:list' to see available recipes.`,
    );
  }

  // Read manifest
  const manifestPath = '.spoonfeeder.json';
  if (!tree.exists(manifestPath)) {
    throw new Error('.spoonfeeder.json not found. Is this a spoonfeeder-generated project?');
  }

  const manifest = JSON.parse(tree.read(manifestPath, 'utf-8')!) as SpoonfeederManifest;

  // Check if already installed
  if (manifest.recipes[recipeId]) {
    logger.warn(`Recipe '${recipeId}' is already installed.`);
    return;
  }

  // Validate compatibility
  if (
    recipe.compatibleWith !== 'all' &&
    !recipe.compatibleWith.includes(manifest.projectType as ProjectType)
  ) {
    throw new Error(
      `Recipe '${recipe.name}' is not compatible with project type '${manifest.projectType}'.`,
    );
  }

  // Check conflicts
  const installedIds = Object.keys(manifest.recipes) as RecipeId[];
  const allIds = [...installedIds, recipeId];
  const allRecipes = allIds.map((id) => registry.get(id)).filter(Boolean) as RecipeDefinition[];
  const conflicts = detectConflicts(allIds, allRecipes);

  const mutualExclusions = conflicts.filter((c) => c.type === 'mutual-exclusion');
  if (mutualExclusions.length > 0) {
    throw new Error(`Conflict: ${mutualExclusions.map((c) => c.message).join('; ')}`);
  }

  // Check requirements
  const missingReqs = conflicts.filter((c) => c.type === 'missing-requirement');
  if (missingReqs.length > 0) {
    throw new Error(`Missing requirements: ${missingReqs.map((c) => c.message).join('; ')}`);
  }

  // 1. Add dependencies to package.json
  if (
    Object.keys(recipe.dependencies).length > 0 ||
    Object.keys(recipe.devDependencies).length > 0
  ) {
    updateJson<PackageJson>(tree, 'package.json', (json) => {
      json.dependencies = { ...json.dependencies, ...recipe.dependencies };
      json.devDependencies = { ...json.devDependencies, ...recipe.devDependencies };

      // Sort alphabetically
      json.dependencies = Object.fromEntries(
        Object.entries(json.dependencies).sort(([a], [b]) => a.localeCompare(b)),
      );
      json.devDependencies = Object.fromEntries(
        Object.entries(json.devDependencies).sort(([a], [b]) => a.localeCompare(b)),
      );

      return json;
    });
  }

  // 2. Copy recipe template files
  // Note: In Phase 1, template file copying is handled externally.
  // Phase 2 adds full AST transforms and template copying via generateFiles.
  const copiedFiles: string[] = [];

  // Note: In Phase 1, we copy files manually since generateFiles expects a specific structure.
  // Template files from the recipe dir are copied into the project root.
  // Files named README.md and package-fragment.json are skipped.

  // 2a. Add module import to app.module.ts (if recipe defines moduleImport)
  if (recipe.moduleImport) {
    const appModulePath = 'src/app.module.ts';
    if (tree.exists(appModulePath)) {
      const content = tree.read(appModulePath, 'utf-8')!;
      const transformed = addModuleImportToString(
        content,
        recipe.moduleImport.moduleName,
        recipe.moduleImport.importPath,
      );
      tree.write(appModulePath, transformed);
      logger.info(`  Added ${recipe.moduleImport.moduleName} to app.module.ts`);
    }
  }

  // 2b. Insert main.ts blocks (if recipe defines mainTsSetup)
  if (recipe.mainTsSetup) {
    const mainTsPath = 'src/main.ts';
    if (tree.exists(mainTsPath)) {
      const content = tree.read(mainTsPath, 'utf-8')!;
      const transformed = insertBlockToString(
        content,
        recipe.mainTsSetup.blockId,
        recipe.mainTsSetup.block as BlockDefinition,
      );
      tree.write(mainTsPath, transformed);
      logger.info(`  Inserted ${recipe.mainTsSetup.blockId} block into main.ts`);
    }
  }

  // 3. Add env vars
  if (recipe.envVars.length > 0) {
    const envPath = '.env.example';
    if (tree.exists(envPath)) {
      let envContent = tree.read(envPath, 'utf-8')!;
      const sectionMarker = `# --- ${recipe.name} ---`;

      if (!envContent.includes(sectionMarker)) {
        const section = [
          '',
          sectionMarker,
          ...recipe.envVars.map((v) => `# ${v.description}\n${v.key}=${v.defaultValue}`),
          `# --- end ${recipe.name} ---`,
          '',
        ].join('\n');

        envContent = envContent.trimEnd() + '\n' + section;
        tree.write(envPath, envContent);
      }
    }
  }

  // 4. Update AI context
  if (recipe.claudeMdSection) {
    const claudePath = 'CLAUDE.md';
    if (tree.exists(claudePath)) {
      let content = tree.read(claudePath, 'utf-8')!;
      const marker = `<!-- @spoonfeeder:${recipeId} -->`;
      if (!content.includes(marker)) {
        content += `\n${marker}\n${recipe.claudeMdSection}\n<!-- @spoonfeeder:end:${recipeId} -->\n`;
        tree.write(claudePath, content);
      }
    }
  }

  // 5. Update manifest
  updateJson<SpoonfeederManifest>(tree, manifestPath, (json) => {
    json.recipes[recipeId] = {
      installedAt: new Date().toISOString(),
      version: json.spoonfeederVersion ?? '0.0.1',
      files: copiedFiles,
      ...(recipe.moduleImport && { moduleImport: recipe.moduleImport }),
      ...(recipe.mainTsSetup && { mainTsBlocks: [recipe.mainTsSetup.blockId] }),
      ...(recipe.envVars.length > 0 && { envSection: recipe.name }),
    };
    return json;
  });

  await formatFiles(tree);

  logger.info(`Recipe '${recipe.name}' added successfully.`);
  if (!options.skipInstall) {
    logger.info('Run `pnpm install` to install new dependencies.');
  }
}
