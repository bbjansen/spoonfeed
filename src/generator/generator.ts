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
import { insertBlockToString } from '../utils/main-ts-updater.js';
import type { BlockDefinition } from '../utils/main-ts-updater.js';

async function copyAndRenderDir(
  sourceDir: string,
  outputDir: string,
  data: Record<string, unknown>,
  skipDirs: string[] = [],
  baseOutputDir?: string,
): Promise<string[]> {
  const base = baseOutputDir ?? outputDir;
  const copiedFiles: string[] = [];

  if (!(await fs.pathExists(sourceDir))) return copiedFiles;

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
      const subFiles = await copyAndRenderDir(
        sourcePath,
        path.join(outputDir, outputName),
        data,
        skipDirs,
        base,
      );
      copiedFiles.push(...subFiles);
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
      const rendered = renderTemplate(template, data, sourcePath);
      await fs.ensureDir(outputDir);
      await fs.writeFile(path.join(outputDir, outputName), rendered, 'utf-8');
    } else {
      await fs.ensureDir(outputDir);
      await fs.copy(sourcePath, path.join(outputDir, outputName));
    }

    copiedFiles.push(path.relative(base, path.join(outputDir, outputName)));
  }

  return copiedFiles;
}

export async function generate(
  config: ProjectConfig,
  registry: RecipeRegistry,
  templatesDir: string,
): Promise<void> {
  const { outputDir } = config;
  const s = p.spinner();

  s.start('Creating project structure...');

  const dirExistedBefore = await fs.pathExists(outputDir);

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

    // 2d. Relocate base template files for workspace project types (full-stack, monorepo)
    //     The base template copies NestJS source to root src/ and tests/, but these
    //     project types keep the NestJS app under apps/api/.
    if (config.projectType === 'full-stack' || config.projectType === 'monorepo') {
      const apiDir = path.join(outputDir, 'apps', 'api');
      await fs.ensureDir(apiDir);

      // Move src/ contents into apps/api/src/ (project-type already placed main.ts and app.module.ts there)
      const rootSrcDir = path.join(outputDir, 'src');
      const apiSrcDir = path.join(apiDir, 'src');
      if (await fs.pathExists(rootSrcDir)) {
        await fs.ensureDir(apiSrcDir);
        const srcEntries = await fs.readdir(rootSrcDir, { withFileTypes: true });
        for (const entry of srcEntries) {
          const srcPath = path.join(rootSrcDir, entry.name);
          const destPath = path.join(apiSrcDir, entry.name);
          // Skip files already provided by the project-type template (main.ts, app.module.ts)
          if (await fs.pathExists(destPath)) continue;
          await fs.move(srcPath, destPath);
        }
        await fs.remove(rootSrcDir);
      }

      // Move tests/ into apps/api/tests/
      const rootTestsDir = path.join(outputDir, 'tests');
      const apiTestsDir = path.join(apiDir, 'tests');
      if (await fs.pathExists(rootTestsDir)) {
        await fs.move(rootTestsDir, apiTestsDir, { overwrite: true });
      }

      // Update nest-cli.json to point entryFile at apps/api/src/main (keep at root)
      const rootNestCli = path.join(outputDir, 'nest-cli.json');
      if (await fs.pathExists(rootNestCli)) {
        const nestCliJson = (await fs.readJson(rootNestCli)) as Record<string, unknown>;
        nestCliJson.sourceRoot = 'apps/api/src';
        nestCliJson.entryFile = 'apps/api/src/main';
        await fs.writeJson(rootNestCli, nestCliJson, { spaces: 2 });
      }

      // Update jest.config.ts paths for workspace layout (tests and src under apps/api/)
      const rootJestConfig = path.join(outputDir, 'jest.config.ts');
      if (await fs.pathExists(rootJestConfig)) {
        let jestContent = await fs.readFile(rootJestConfig, 'utf-8');
        jestContent = jestContent
          .replace(/<rootDir>\/tests\//g, '<rootDir>/apps/api/tests/')
          .replace(/<rootDir>\/src\//g, '<rootDir>/apps/api/src/')
          .replace(
            /collectCoverageFrom:\s*\['src\//g,
            "collectCoverageFrom: ['apps/api/src/",
          )
          .replace("'!src/**/*.spec.ts'", "'!apps/api/src/**/*.spec.ts'")
          .replace("'!src/main.ts'", "'!apps/api/src/main.ts'");
        await fs.writeFile(rootJestConfig, jestContent, 'utf-8');
      }

      // Update tsconfig.json paths: @/* -> apps/api/src/*
      const rootTsConfig = path.join(outputDir, 'tsconfig.json');
      if (await fs.pathExists(rootTsConfig)) {
        const tsConfig = (await fs.readJson(rootTsConfig)) as Record<string, unknown>;
        const compilerOptions = tsConfig.compilerOptions as Record<string, unknown>;
        if (compilerOptions?.paths) {
          compilerOptions.paths = { '@/*': ['apps/api/src/*'] };
        }
        await fs.writeJson(rootTsConfig, tsConfig, { spaces: 2 });
      }
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

    // 4. Copy recipe template directories (track files per recipe for manifest)
    //    For workspace projects (full-stack, monorepo), recipe src/ and tests/ go under apps/api/
    const isWorkspaceProject =
      config.projectType === 'full-stack' || config.projectType === 'monorepo';
    const recipeOutputDir = isWorkspaceProject
      ? path.join(outputDir, 'apps', 'api')
      : outputDir;
    const recipeFilesMap = new Map<string, string[]>();
    for (const recipe of selectedRecipes) {
      if (recipe.templateDir) {
        const recipeTemplateDir = path.join(templatesDir, 'recipes', recipe.templateDir);
        const files = await copyAndRenderDir(recipeTemplateDir, recipeOutputDir, templateData);
        recipeFilesMap.set(recipe.id, files);
      }
    }

    // 4b. Apply recipe main.ts blocks
    const mainTsPath = isWorkspaceProject
      ? path.join(outputDir, 'apps', 'api', 'src', 'main.ts')
      : path.join(outputDir, 'src', 'main.ts');
    const appliedMainTsBlocks = new Set<string>();
    if (await fs.pathExists(mainTsPath)) {
      let mainTsContent = await fs.readFile(mainTsPath, 'utf-8');
      for (const recipe of selectedRecipes) {
        if (recipe.mainTsSetup) {
          mainTsContent = insertBlockToString(
            mainTsContent,
            recipe.mainTsSetup.blockId,
            recipe.mainTsSetup.block as BlockDefinition,
          );
          appliedMainTsBlocks.add(recipe.id);
        }
      }
      await fs.writeFile(mainTsPath, mainTsContent, 'utf-8');
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

    // 10. Create .spoonfeed.json manifest
    const manifest = {
      projectType: config.projectType,
      cloudProvider: config.cloudProvider,
      spoonfeedVersion: '0.0.1',
      generatedAt: new Date().toISOString(),
      recipes: Object.fromEntries(
        selectedRecipes.map((recipe) => {
          return [
            recipe.id,
            {
              installedAt: new Date().toISOString(),
              version: '0.0.1',
              files: recipeFilesMap.get(recipe.id) ?? [],
              ...(recipe.mainTsSetup &&
                appliedMainTsBlocks.has(recipe.id) && {
                  mainTsBlocks: [recipe.mainTsSetup.blockId],
                }),
            },
          ];
        }),
      ),
    };
    await fs.writeJson(path.join(outputDir, '.spoonfeed.json'), manifest, { spaces: 2 });

    s.stop('Project structure created.');
  } catch (error) {
    s.stop('Project generation failed.');
    if (!dirExistedBefore) await fs.remove(outputDir);
    throw error;
  }
}
