/**
 * Express adapter recipe lifecycle E2E tests
 *
 * Tests the full add-recipe / remove-recipe lifecycle on Express-based projects.
 * Verifies that adapter-aware dependency resolution, main.ts block injection,
 * and clean removal all work end-to-end with real filesystem + TypeScript compilation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import addRecipeGenerator from '@spoonfeed/generators/add-recipe/generator';
import removeRecipeGenerator from '@spoonfeed/generators/remove-recipe/generator';
import type { ProjectConfig } from '@spoonfeed/types';
import type { Tree } from '@nx/devkit';

jest.setTimeout(15 * 60 * 1000);

// Suppress clack spinner in tests
jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function makeConfig(overrides: Partial<ProjectConfig>): ProjectConfig {
  return {
    name: 'e2e-express-test',
    scope: undefined,
    projectType: 'http-api',
    cloudProvider: 'none',
    httpAdapter: 'express',
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
function run(command: string, args: string[], cwd: string, timeoutMs = 90_000): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf-8',
    timeout: timeoutMs,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });
}

/**
 * Creates a Tree backed by a real filesystem directory by reading all files
 * into an in-memory Nx tree, so generators can operate on it.
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
 * Also handles files that existed on disk but were deleted from the tree.
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

// ═══════════════════════════════════════════════════════════════════════════════
// Express adapter: add / remove recipe lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

describe('Express adapter: add/remove recipe lifecycle', () => {
  let tmpDir: string;
  let outputDir: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-e2e-express-'));
    outputDir = path.join(tmpDir, 'express-api');

    // Generate an Express http-api project with swagger + pino as base recipes
    const config = makeConfig({
      projectType: 'http-api',
      httpAdapter: 'express',
      recipes: ['swagger', 'pino'],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);

    // Install dependencies once for the base project
    run('pnpm', ['install', '--no-frozen-lockfile'], outputDir);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Baseline validation ─────────────────────────────────────────────────

  it('base Express project type-checks', () => {
    run('pnpm', ['exec', 'tsc', '--noEmit'], outputDir, 60_000);
  });

  it('base Express project has correct adapter deps (no fastify)', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
    ) as { dependencies: Record<string, string> };

    expect(pkg.dependencies['@nestjs/platform-express']).toBeDefined();
    expect(pkg.dependencies['express']).toBeDefined();
    // Must NOT have fastify adapter
    expect(pkg.dependencies['@nestjs/platform-fastify']).toBeUndefined();
    expect(pkg.dependencies['fastify']).toBeUndefined();
  });

  it('base Express main.ts uses NestFactory.create without FastifyAdapter', () => {
    const mainTs = fs.readFileSync(path.join(outputDir, 'src/main.ts'), 'utf-8');

    expect(mainTs).toContain('NestFactory.create(AppModule)');
    expect(mainTs).not.toContain('FastifyAdapter');
    expect(mainTs).not.toContain('NestFastifyApplication');
  });

  it('manifest records httpAdapter as express', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputDir, '.spoonfeed.json'), 'utf-8'),
    ) as { httpAdapter: string };

    expect(manifest.httpAdapter).toBe('express');
  });

  // ─── Helmet: add then remove ─────────────────────────────────────────────

  it('add helmet: Express deps (not fastify), main.ts block, compiles', async () => {
    // Add helmet via the add-recipe generator
    const { tree, diskFiles } = createTreeFromDirectory(outputDir);
    await addRecipeGenerator(tree, { recipe: 'helmet', skipInstall: true });
    flushTreeChanges(tree, outputDir, diskFiles);

    // Verify package.json has Express helmet dep
    const pkg = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['helmet']).toBeDefined();
    expect(pkg.dependencies['@fastify/helmet']).toBeUndefined();

    // Verify main.ts has the Express helmet block (app.use)
    const mainTs = fs.readFileSync(path.join(outputDir, 'src/main.ts'), 'utf-8');
    expect(mainTs).toContain('// --- helmet start ---');
    expect(mainTs).toContain('app.use(');
    expect(mainTs).toContain('helmet(');
    expect(mainTs).toContain('// --- helmet end ---');
    // Must NOT have fastify register pattern
    expect(mainTs).not.toContain('app.register(helmet');

    // Verify manifest
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputDir, '.spoonfeed.json'), 'utf-8'),
    ) as { recipes: Record<string, { mainTsBlocks?: string[] }> };
    expect(manifest.recipes['helmet']).toBeDefined();
    expect(manifest.recipes['helmet'].mainTsBlocks).toContain('helmet');

    // Install new deps and type-check
    run('pnpm', ['install', '--no-frozen-lockfile'], outputDir);
    run('pnpm', ['exec', 'tsc', '--noEmit'], outputDir, 60_000);
  });

  it('remove helmet: deps gone, main.ts block gone, compiles', async () => {
    // Remove helmet via the remove-recipe generator
    const { tree, diskFiles } = createTreeFromDirectory(outputDir);
    await removeRecipeGenerator(tree, { recipe: 'helmet' });
    flushTreeChanges(tree, outputDir, diskFiles);

    // Verify package.json no longer has helmet
    const pkg = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['helmet']).toBeUndefined();
    expect(pkg.dependencies['@fastify/helmet']).toBeUndefined();

    // Verify main.ts no longer has the helmet block
    const mainTs = fs.readFileSync(path.join(outputDir, 'src/main.ts'), 'utf-8');
    expect(mainTs).not.toContain('// --- helmet start ---');
    expect(mainTs).not.toContain('// --- helmet end ---');
    // Base content preserved
    expect(mainTs).toContain('NestFactory');

    // Verify manifest
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputDir, '.spoonfeed.json'), 'utf-8'),
    ) as { recipes: Record<string, unknown> };
    expect(manifest.recipes['helmet']).toBeUndefined();

    // Reinstall and type-check
    run('pnpm', ['install', '--no-frozen-lockfile'], outputDir);
    run('pnpm', ['exec', 'tsc', '--noEmit'], outputDir, 60_000);
  });

  // ─── OpenTelemetry: Express-specific deps ─────────────────────────────────

  it('add opentelemetry: Express deps (instrumentation-express, not -fastify)', async () => {
    const { tree, diskFiles } = createTreeFromDirectory(outputDir);
    await addRecipeGenerator(tree, { recipe: 'opentelemetry', skipInstall: true });
    flushTreeChanges(tree, outputDir, diskFiles);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
    ) as { dependencies: Record<string, string> };

    // Must have Express instrumentation, NOT fastify
    expect(pkg.dependencies['@opentelemetry/instrumentation-express']).toBeDefined();
    expect(pkg.dependencies['@opentelemetry/instrumentation-fastify']).toBeUndefined();
    // Shared deps should still be present
    expect(pkg.dependencies['@opentelemetry/sdk-node']).toBeDefined();
    expect(pkg.dependencies['@opentelemetry/instrumentation-http']).toBeDefined();

    // Verify manifest
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputDir, '.spoonfeed.json'), 'utf-8'),
    ) as { recipes: Record<string, unknown> };
    expect(manifest.recipes['opentelemetry']).toBeDefined();

    // Clean up: remove opentelemetry for the next test
    const { tree: tree2, diskFiles: df2 } = createTreeFromDirectory(outputDir);
    await removeRecipeGenerator(tree2, { recipe: 'opentelemetry' });
    flushTreeChanges(tree2, outputDir, df2);
  });

  // ─── CSRF: Express-specific deps ──────────────────────────────────────────

  it('add csrf: Express deps (csrf-csrf, not @fastify/csrf-protection)', async () => {
    const { tree, diskFiles } = createTreeFromDirectory(outputDir);
    await addRecipeGenerator(tree, { recipe: 'csrf', skipInstall: true });
    flushTreeChanges(tree, outputDir, diskFiles);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
    ) as { dependencies: Record<string, string> };

    // Must have Express CSRF deps, NOT fastify
    expect(pkg.dependencies['csrf-csrf']).toBeDefined();
    expect(pkg.dependencies['cookie-parser']).toBeDefined();
    expect(pkg.dependencies['@fastify/csrf-protection']).toBeUndefined();
    expect(pkg.dependencies['@fastify/cookie']).toBeUndefined();

    // Verify manifest
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputDir, '.spoonfeed.json'), 'utf-8'),
    ) as { recipes: Record<string, unknown> };
    expect(manifest.recipes['csrf']).toBeDefined();

    // Clean up: remove csrf
    const { tree: tree2, diskFiles: df2 } = createTreeFromDirectory(outputDir);
    await removeRecipeGenerator(tree2, { recipe: 'csrf' });
    flushTreeChanges(tree2, outputDir, df2);
  });
});
