import path from 'node:path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import type { ProjectConfig, RecipeDefinition } from '../types.js';
import { RecipeRegistry } from '../recipes/registry.js';
import { renderTemplate } from './template-engine.js';
import { mergePackageJson } from './package-json-merger.js';
import { mergeEnvVars, renderEnvFile } from './env-merger.js';
import {
  assembleClaudeMd,
  assembleCursorRules,
  assembleCopilotInstructions,
} from './ai-context-assembler.js';
import { insertBlock } from '../utils/main-ts-updater.js';
import type { BlockDefinition } from '../utils/main-ts-updater.js';

async function copyAndRenderDir(
  sourceDir: string,
  outputDir: string,
  data: Record<string, unknown>,
  skipDirs: string[] = [],
): Promise<void> {
  if (!(await fs.pathExists(sourceDir))) return;

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    let outputName = entry.name;

    // Handle dot-prefixed directories (dot-husky -> .husky)
    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name)) continue;
      if (outputName.startsWith('dot-')) {
        outputName = '.' + outputName.slice(4);
      }
      await copyAndRenderDir(sourcePath, path.join(outputDir, outputName), data, skipDirs);
      continue;
    }

    // Skip package fragments and READMEs (handled separately)
    if (outputName === 'package-fragment.json' || outputName === 'README.md') continue;

    // Handle dot-prefixed files (dot-gitignore -> .gitignore)
    if (outputName.startsWith('dot-')) {
      outputName = '.' + outputName.slice(4);
    }

    if (outputName.endsWith('.ejs')) {
      outputName = outputName.replace(/\.ejs$/, '');
      const template = await fs.readFile(sourcePath, 'utf-8');
      const rendered = renderTemplate(template, data);
      await fs.ensureDir(outputDir);
      await fs.writeFile(path.join(outputDir, outputName), rendered, 'utf-8');
    } else {
      await fs.ensureDir(outputDir);
      await fs.copy(sourcePath, path.join(outputDir, outputName));
    }
  }
}

export async function generate(
  config: ProjectConfig,
  registry: RecipeRegistry,
  templatesDir: string,
): Promise<void> {
  const { outputDir } = config;
  const s = p.spinner();

  s.start('Creating project structure...');

  try {
    await fs.ensureDir(outputDir);

    const templateData: Record<string, unknown> = {
      name: config.name,
      packageScope: config.scope,
      projectType: config.projectType,
      cloudProvider: config.cloudProvider,
      transportLayer: config.transportLayer,
      frontendFramework: config.frontendFramework,
    };

    // 1. Copy and render base templates
    await copyAndRenderDir(path.join(templatesDir, 'base'), outputDir, templateData);

    // 2. Overlay project-type-specific templates (skip frontend/ — handled in step 2c)
    const projectTypeDir = path.join(templatesDir, 'project-types', config.projectType);
    await copyAndRenderDir(projectTypeDir, outputDir, templateData, ['frontend']);

    // 2c. Copy frontend framework for full-stack projects
    if (config.projectType === 'full-stack' && config.frontendFramework) {
      const frontendDir = path.join(
        templatesDir,
        'project-types',
        'full-stack',
        'frontend',
        config.frontendFramework,
      );
      await copyAndRenderDir(frontendDir, path.join(outputDir, 'apps', 'web'), templateData);
    }

    // 2b. Load project-type package fragment
    const projectTypeFragmentPath = path.join(projectTypeDir, 'package-fragment.json');
    const projectTypeFragment = (await fs.pathExists(projectTypeFragmentPath))
      ? ((await fs.readJson(projectTypeFragmentPath)) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        })
      : undefined;

    // 3. Collect recipe definitions
    const selectedRecipes: RecipeDefinition[] = [];
    for (const recipeId of config.recipes) {
      const recipe = registry.get(recipeId);
      if (recipe) {
        selectedRecipes.push(recipe);
      } else {
        p.log.warning(`Recipe '${recipeId}' not found in registry, skipping.`);
      }
    }

    // 4. Copy recipe template directories
    for (const recipe of selectedRecipes) {
      if (recipe.templateDir) {
        const recipeTemplateDir = path.join(templatesDir, 'recipes', recipe.templateDir);
        await copyAndRenderDir(recipeTemplateDir, outputDir, templateData);
      }
    }

    // 4b. Apply recipe main.ts blocks
    const mainTsPath = path.join(outputDir, 'src', 'main.ts');
    for (const recipe of selectedRecipes) {
      if (recipe.mainTsSetup) {
        insertBlock(
          mainTsPath,
          recipe.mainTsSetup.blockId,
          recipe.mainTsSetup.block as BlockDefinition,
        );
      }
    }

    // 5. Copy deployment templates
    for (const target of config.deploymentTargets) {
      const deployDir = path.join(templatesDir, 'recipes', 'deploy', target);
      await copyAndRenderDir(deployDir, outputDir, templateData);
    }

    // 6. Copy CI/CD templates
    if (config.ciCdProvider) {
      const ciCdDir = path.join(templatesDir, 'recipes', 'ci-cd', config.ciCdProvider);
      await copyAndRenderDir(ciCdDir, outputDir, templateData);
    }

    // 7. Merge package.json with project-type and recipe fragments
    const basePackageJson = (await fs.readJson(path.join(outputDir, 'package.json'))) as Record<
      string,
      unknown
    >;
    const fragments = [
      ...(projectTypeFragment
        ? [
            {
              dependencies: projectTypeFragment.dependencies ?? {},
              devDependencies: projectTypeFragment.devDependencies ?? {},
            },
          ]
        : []),
      ...selectedRecipes.map((r) => ({
        dependencies: r.dependencies,
        devDependencies: r.devDependencies,
      })),
    ];
    const mergedPackageJson = mergePackageJson(basePackageJson, fragments);
    await fs.writeJson(path.join(outputDir, 'package.json'), mergedPackageJson, {
      spaces: 2,
    });

    // 8. Merge env vars
    const baseEnvVars = [
      { key: 'PORT', defaultValue: '3000', description: 'HTTP port' },
      { key: 'NODE_ENV', defaultValue: 'development', description: 'Environment' },
    ];
    const recipeEnvVars = selectedRecipes.map((r) => r.envVars);
    const mergedEnvVars = mergeEnvVars(baseEnvVars, recipeEnvVars);
    await fs.writeFile(path.join(outputDir, '.env.example'), renderEnvFile(mergedEnvVars), 'utf-8');

    // 9. Assemble AI context
    await assembleClaudeMd(outputDir, config, selectedRecipes);
    await assembleCursorRules(outputDir, selectedRecipes);
    await assembleCopilotInstructions(outputDir, selectedRecipes);

    // 10. Create .spoonfeeder.json manifest
    const manifest = {
      projectType: config.projectType,
      cloudProvider: config.cloudProvider,
      spoonfeederVersion: '0.0.1',
      generatedAt: new Date().toISOString(),
      recipes: Object.fromEntries(
        config.recipes.map((id) => {
          const recipe = registry.get(id);
          return [
            id,
            {
              installedAt: new Date().toISOString(),
              version: '0.0.1',
              files: [],
              ...(recipe?.mainTsSetup && { mainTsBlocks: [recipe.mainTsSetup.blockId] }),
            },
          ];
        }),
      ),
    };
    await fs.writeJson(path.join(outputDir, '.spoonfeeder.json'), manifest, { spaces: 2 });

    s.stop('Project structure created.');
  } catch (error) {
    s.stop('Project generation failed.');
    throw error;
  }
}
