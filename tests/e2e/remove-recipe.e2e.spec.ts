import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import removeRecipeGenerator from '@spoonfeed/generators/remove-recipe/generator';
import type { ProjectConfig } from '@spoonfeed/types';
import type { Tree } from '@nx/devkit';

jest.setTimeout(120_000);

// Suppress clack spinner in tests
jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function makeConfig(overrides: Partial<ProjectConfig>): ProjectConfig {
  return {
    name: 'e2e-test',
    scope: undefined,
    projectType: 'http-api',
    cloudProvider: 'none',
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
  const r = new RecipeRegistry();
  registerAllRecipes(r);
  return r;
}

/**
 * Runs a command safely using execFileSync (no shell injection risk).
 */
function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf-8',
    timeout: 90_000,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });
}

/**
 * Creates a Tree backed by a real filesystem directory by reading all files
 * into an in-memory Nx tree, running the generator, then flushing changes back.
 *
 * Returns the tree and the set of file paths that were read from disk,
 * so flushTreeChanges can detect files that were deleted from the tree
 * but still exist on disk (Nx virtual trees swallow CREATE→DELETE transitions).
 */
function createTreeFromDirectory(dirPath: string): { tree: Tree; diskFiles: Set<string> } {
  const tree = createTreeWithEmptyWorkspace();
  const diskFiles = new Set<string>();

  function readDirRecursive(dir: string, prefix: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      if (entry.isDirectory()) {
        readDirRecursive(fullPath, relativePath);
      } else if (entry.isFile()) {
        tree.write(relativePath, fs.readFileSync(fullPath, 'utf-8'));
        diskFiles.add(relativePath);
      }
    }
  }

  readDirRecursive(dirPath, '');
  return { tree, diskFiles };
}

/**
 * Flushes changes from an Nx Tree back to the real filesystem.
 *
 * Also handles files that existed on disk and were deleted from the tree —
 * Nx virtual trees don't emit DELETE for files that were CREATE'd then DELETE'd.
 */
function flushTreeChanges(tree: Tree, dirPath: string, diskFiles: Set<string>): void {
  const changes = tree.listChanges();
  for (const change of changes) {
    const fullPath = path.join(dirPath, change.path);
    if (change.type === 'CREATE' || change.type === 'UPDATE') {
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      if (change.content) {
        fs.writeFileSync(fullPath, change.content);
      }
    } else if (change.type === 'DELETE') {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  }

  // Delete files that existed on disk but are no longer in the tree
  for (const filePath of diskFiles) {
    if (!tree.exists(filePath)) {
      const fullPath = path.join(dirPath, filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  }
}

describe('remove-recipe E2E', () => {
  let tmpDir: string;
  let outputDir: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-e2e-remove-'));
    outputDir = path.join(tmpDir, 'e2e-remove-test');

    // Generate a project with swagger recipe
    const config = makeConfig({
      projectType: 'http-api',
      recipes: ['swagger'],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add swagger, build, remove swagger, build — both succeed', async () => {
    // Step 1: Verify base project files exist
    expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, '.spoonfeed.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app.module.ts'))).toBe(true);

    // Step 2: Install dependencies
    run('pnpm', ['install'], outputDir);

    // Step 3: Build with swagger — should succeed
    run('pnpm', ['exec', 'tsc', '--noEmit'], outputDir);

    // Verify swagger is in manifest
    const manifestAfterAdd = JSON.parse(
      fs.readFileSync(path.join(outputDir, '.spoonfeed.json'), 'utf-8'),
    ) as { recipes: Record<string, unknown> };
    expect(manifestAfterAdd.recipes['swagger']).toBeDefined();

    // Verify @nestjs/swagger is in package.json
    const pkgAfterAdd = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
    ) as { dependencies: Record<string, string> };
    expect(pkgAfterAdd.dependencies['@nestjs/swagger']).toBeDefined();

    // Step 4: Remove swagger recipe using the generator with a Tree backed by the filesystem
    const { tree, diskFiles } = createTreeFromDirectory(outputDir);
    await removeRecipeGenerator(tree, { recipe: 'swagger' });
    flushTreeChanges(tree, outputDir, diskFiles);

    // Step 5: Reinstall to clean lockfile
    run('pnpm', ['install', '--no-frozen-lockfile'], outputDir);

    // Step 6: Build after removal — should succeed
    run('pnpm', ['exec', 'tsc', '--noEmit'], outputDir);

    // Verify swagger is gone from manifest
    const manifestAfterRemove = JSON.parse(
      fs.readFileSync(path.join(outputDir, '.spoonfeed.json'), 'utf-8'),
    ) as { recipes: Record<string, unknown> };
    expect(manifestAfterRemove.recipes['swagger']).toBeUndefined();

    // Verify @nestjs/swagger is gone from package.json
    const pkgAfterRemove = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
    ) as { dependencies: Record<string, string> };
    expect(pkgAfterRemove.dependencies['@nestjs/swagger']).toBeUndefined();
  });
});
