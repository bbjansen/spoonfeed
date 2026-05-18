import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { Tree, formatFiles, updateJson, logger } from '@nx/devkit';
import type { AddRecipeGeneratorSchema } from './schema.js';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';
import { detectConflicts } from '../../validation/conflict-detector.js';
import type { ProjectType, RecipeDefinition, RecipeId } from '../../types.js';
import { addModuleImportToString } from '../../utils/module-updater.js';
import { insertBlockToString } from '../../utils/main-ts-updater.js';
import type { BlockDefinition } from '../../utils/main-ts-updater.js';
import { renderTemplate } from '../../generator/template-engine.js';
import type { SpoonfeedManifest } from '../../utils/recipe-manifest.js';

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
      `Recipe '${recipeId}' not found. Run 'nx g spoonfeed:list' to see available recipes.`,
    );
  }

  // Read manifest
  const manifestPath = '.spoonfeed.json';
  if (!tree.exists(manifestPath)) {
    throw new Error('.spoonfeed.json not found. Is this a spoonfeed-generated project?');
  }

  const manifest = JSON.parse(tree.read(manifestPath, 'utf-8')!) as SpoonfeedManifest;
  const httpAdapter = manifest.httpAdapter ?? 'fastify';

  // Workspace-aware source paths
  const isWorkspace = manifest.projectType === 'full-stack' || manifest.projectType === 'monorepo';
  const srcPrefix = isWorkspace ? 'apps/api/src' : 'src';

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

  // Validate adapter-specific constraints
  if (recipeId === 'graphql-mercurius' && (manifest.httpAdapter ?? 'fastify') === 'express') {
    throw new Error("Recipe 'graphql-mercurius' requires the Fastify HTTP adapter");
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
  if (!tree.exists('package.json')) {
    throw new Error('package.json not found. Is this a valid project?');
  }

  const deps = httpAdapter === 'express' && recipe.expressDependencies
    ? recipe.expressDependencies
    : recipe.dependencies;

  if (
    Object.keys(deps).length > 0 ||
    Object.keys(recipe.devDependencies).length > 0
  ) {
    updateJson<PackageJson>(tree, 'package.json', (json) => {
      json.dependencies = { ...json.dependencies, ...deps };
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
  const copiedFiles: string[] = [];

  if (recipe.templateDir) {
    const templatesDir = path.resolve(generatorDir, '..', '..', '..', 'templates');
    const recipeTemplateDir = path.join(templatesDir, 'recipes', recipe.templateDir);
    const outputPrefix = isWorkspace ? 'apps/api' : '';
    const templateData: Record<string, unknown> = {
      name: manifest.name ?? '',
      packageScope: manifest.scope ?? '',
      projectType: manifest.projectType,
      cloudProvider: manifest.cloudProvider,
      httpAdapter,
      transportLayer: manifest.transportLayer,
      frontendFramework: manifest.frontendFramework,
    };

    if (await fs.pathExists(recipeTemplateDir)) {
      const copyRecursive = async (sourceDir: string, relativeBase: string): Promise<void> => {
        const entries = await fs.readdir(sourceDir, { withFileTypes: true });
        for (const entry of entries) {
          const sourcePath = path.join(sourceDir, entry.name);
          let outputName = entry.name;

          if (entry.isDirectory()) {
            if (outputName.startsWith('dot-')) {
              outputName = '.' + outputName.slice(4);
            }
            await copyRecursive(sourcePath, path.join(relativeBase, outputName));
            continue;
          }

          // Skip package fragments and READMEs (handled separately)
          if (outputName === 'package-fragment.json' || outputName === 'README.md') continue;

          if (outputName.startsWith('dot-')) {
            outputName = '.' + outputName.slice(4);
          }

          let fileContent: string | Buffer;
          if (outputName.endsWith('.ejs')) {
            outputName = outputName.replace(/\.ejs$/, '');
            const template = await fs.readFile(sourcePath, 'utf-8');
            fileContent = renderTemplate(template, templateData, sourcePath);
          } else {
            fileContent = await fs.readFile(sourcePath);
          }

          const relativePath = path.join(relativeBase, outputName);
          const treePath = outputPrefix ? path.join(outputPrefix, relativePath) : relativePath;
          tree.write(treePath, fileContent);
          copiedFiles.push(treePath);
        }
      };

      await copyRecursive(recipeTemplateDir, '');
      if (copiedFiles.length > 0) {
        logger.info(`  Copied ${copiedFiles.length} template file(s) for '${recipe.name}'`);
      }
    }
  }

  // 2-frag. Merge recipe package-fragment.json (scripts + extra deps) into package.json
  if (recipe.templateDir) {
    const templatesDir = path.resolve(generatorDir, '..', '..', '..', 'templates');
    const fragmentPath = path.join(templatesDir, 'recipes', recipe.templateDir, 'package-fragment.json');
    if (await fs.pathExists(fragmentPath)) {
      const fragment: PackageFragment = await fs.readJson(fragmentPath);
      updateJson<PackageJson>(tree, 'package.json', (json) => {
        if (fragment.scripts && Object.keys(fragment.scripts).length > 0) {
          json.scripts = { ...json.scripts, ...fragment.scripts };
        }
        if (fragment.dependencies && Object.keys(fragment.dependencies).length > 0) {
          json.dependencies = { ...json.dependencies, ...fragment.dependencies };
          json.dependencies = Object.fromEntries(
            Object.entries(json.dependencies).sort(([a], [b]) => a.localeCompare(b)),
          );
        }
        if (fragment.devDependencies && Object.keys(fragment.devDependencies).length > 0) {
          json.devDependencies = { ...json.devDependencies, ...fragment.devDependencies };
          json.devDependencies = Object.fromEntries(
            Object.entries(json.devDependencies).sort(([a], [b]) => a.localeCompare(b)),
          );
        }
        return json;
      });
      logger.info(`  Merged package-fragment.json for '${recipe.name}'`);
    }
  }

  // 2a. Add module import to app.module.ts (if recipe defines moduleImport)
  if (recipe.moduleImport) {
    const appModulePath = `${srcPrefix}/app.module.ts`;
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
  const setup = httpAdapter === 'express' && recipe.expressMainTsSetup
    ? recipe.expressMainTsSetup
    : recipe.mainTsSetup;
  if (setup) {
    const mainTsPath = `${srcPrefix}/main.ts`;
    if (tree.exists(mainTsPath)) {
      const content = tree.read(mainTsPath, 'utf-8')!;
      const transformed = insertBlockToString(
        content,
        setup.blockId,
        setup.block as BlockDefinition,
      );
      tree.write(mainTsPath, transformed);
      logger.info(`  Inserted ${setup.blockId} block into main.ts`);
    }
  }

  // 3. Add env vars
  if (recipe.envVars.length > 0) {
    const envPath = '.env.example';
    if (tree.exists(envPath)) {
      let envContent = tree.read(envPath, 'utf-8')!;
      const sectionMarker = `# --- ${recipe.name} ---`;

      if (!envContent.includes(sectionMarker)) {
        const envLines: string[] = [];
        for (const v of recipe.envVars) {
          // Check if this key already exists as an active line (KEY=...) in another section
          const existingKeyRegex = new RegExp(`^${escapeRegexString(v.key)}=`, 'm');
          const existingMatch = envContent.match(existingKeyRegex);
          if (existingMatch) {
            // Find which section owns this key by scanning backwards for a section marker
            const ownerSection = findEnvSectionForKey(envContent, v.key);
            envLines.push(
              `# ${v.description}`,
              `# ${v.key}=${v.defaultValue} (shared with ${ownerSection})`,
            );
          } else {
            envLines.push(`# ${v.description}`, `${v.key}=${v.defaultValue}`);
          }
        }

        const section = [
          '',
          sectionMarker,
          ...envLines,
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
      const marker = `<!-- @spoonfeed:${recipeId} -->`;
      if (!content.includes(marker)) {
        content += `\n${marker}\n${recipe.claudeMdSection}\n<!-- @spoonfeed:end:${recipeId} -->\n`;
        tree.write(claudePath, content);
      }
    }
  }

  if (recipe.copilotInstructions) {
    const copilotPath = '.github/copilot-instructions.md';
    if (tree.exists(copilotPath)) {
      let content = tree.read(copilotPath, 'utf-8')!;
      const marker = `<!-- @spoonfeed:${recipeId} -->`;
      if (!content.includes(marker)) {
        content += `\n${marker}\n${recipe.copilotInstructions}\n<!-- @spoonfeed:end:${recipeId} -->\n`;
        tree.write(copilotPath, content);
      }
    }
  }

  if (recipe.cursorRules) {
    const cursorRulePath = `.cursor/rules/${recipeId}.mdc`;
    if (!tree.exists(cursorRulePath)) {
      tree.write(cursorRulePath, recipe.cursorRules);
    }
  }

  // 5. Update manifest
  updateJson<SpoonfeedManifest>(tree, manifestPath, (json) => {
    json.recipes[recipeId] = {
      installedAt: new Date().toISOString(),
      version: json.spoonfeedVersion ?? '0.0.1',
      files: copiedFiles,
      ...(recipe.moduleImport && { moduleImport: recipe.moduleImport }),
      ...(setup && { mainTsBlocks: [setup.blockId] }),
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

/**
 * Escapes special regex characters in a string so it can be used in a RegExp constructor.
 */
function escapeRegexString(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the env section name that contains an active (uncommented) KEY= line.
 * Scans backwards from the key's position to find the nearest section start marker.
 * Returns the section name, or 'unknown' if no section marker is found.
 */
function findEnvSectionForKey(content: string, key: string): string {
  const activeLineRegex = new RegExp(`^${escapeRegexString(key)}=`, 'm');
  const match = activeLineRegex.exec(content);
  if (!match) return 'unknown';

  const beforeKey = content.slice(0, match.index);
  const sectionMarkerRegex = /^# --- (.+?) ---$/gm;
  let lastSection = 'unknown';
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionMarkerRegex.exec(beforeKey)) !== null) {
    // Skip end markers
    if (!sectionMatch[1].startsWith('end ')) {
      lastSection = sectionMatch[1];
    }
  }

  return lastSection;
}
