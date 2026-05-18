import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { RECIPE_IDS } from '@spoonfeed/types';
import type { ProjectConfig, ProjectType, RecipeId } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const TEXT_FILE_EXTENSIONS = ['.ts', '.js', '.json', '.yml', '.yaml', '.md', '.mdc', '.mjs'];

const NON_HTTP_PROJECT_TYPES: ProjectType[] = ['microservice', 'cli-app', 'scheduled-worker'];

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'solo-recipe-test',
    scope: undefined,
    projectType: 'http-api',
    cloudProvider: 'none',
    httpAdapter: 'fastify',
    recipes: [],
    transportLayer: undefined,
    frontendFramework: undefined,
    deploymentTargets: [],
    ciCdProvider: undefined,
    outputDir: '',
    ...overrides,
  };
}

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

/**
 * Recursively collect all files under a directory matching the given extensions.
 */
function walkFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Determine the best project type for a recipe based on its compatibleWith field.
 * HTTP project types get Express adapter; non-HTTP types get Fastify (adapter is irrelevant).
 */
function resolveProjectType(compatibleWith: ProjectType[] | 'all'): ProjectType {
  if (compatibleWith === 'all') {
    return 'http-api';
  }
  return compatibleWith[0];
}

describe('Every recipe generates cleanly with Express adapter', () => {
  let outputDir: string;
  const registry = createRegistry();

  afterEach(() => {
    if (outputDir && fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it.each([...RECIPE_IDS])('%s', async (recipeId: RecipeId) => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-solo-${recipeId}-`));

    const recipe = registry.get(recipeId);
    expect(recipe).toBeDefined();

    const projectType = resolveProjectType(recipe!.compatibleWith);
    const isNonHttp = NON_HTTP_PROJECT_TYPES.includes(projectType);

    // Collect recipes: include required recipes if any
    const recipes: RecipeId[] = [...recipe!.requires, recipeId];

    const config = makeConfig({
      outputDir,
      projectType,
      httpAdapter: isNonHttp ? 'fastify' : 'express',
      recipes,
      transportLayer: projectType === 'microservice' ? 'tcp' : undefined,
      frontendFramework: projectType === 'full-stack' ? 'nextjs' : undefined,
    });

    await generate(config, registry, TEMPLATES_DIR);

    // Walk all generated text files and assert none contain raw EJS tags
    const files = walkFiles(outputDir, TEXT_FILE_EXTENSIONS);
    expect(files.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('<%')) {
        const relative = path.relative(outputDir, filePath);
        failures.push(relative);
      }
    }

    expect(failures).toEqual([]);
  });
});
