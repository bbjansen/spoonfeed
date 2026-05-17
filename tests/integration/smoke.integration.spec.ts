import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeeder/generator/generator';
import { RecipeRegistry } from '@spoonfeeder/recipes/registry';
import { registerAllRecipes } from '@spoonfeeder/recipes/definitions';
import type { ProjectConfig } from '@spoonfeeder/types';

// Suppress @clack/prompts spinner output in tests
jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

/**
 * Runs a shell command in the given directory.
 * All commands here are hardcoded strings with no user input, so execSync is safe.
 */
function exec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 90_000, stdio: 'pipe' });
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    const details = [e.stdout, e.stderr].filter(Boolean).join('\n');
    throw new Error(`Command failed: ${cmd}\n${details}`);
  }
}

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'smoke-test-project',
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
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

describe('Smoke tests: generated projects install and build', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeeder-smoke-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('http-api: installs and builds successfully', async () => {
    const config = makeConfig({ outputDir, projectType: 'http-api' });
    await generate(config, registry, TEMPLATES_DIR);

    exec('pnpm install --ignore-scripts', outputDir);
    exec('pnpm exec tsc --noEmit', outputDir);
  }, 120_000);

  it('aws-lambda: installs and builds successfully', async () => {
    const config = makeConfig({ outputDir, projectType: 'aws-lambda' });
    await generate(config, registry, TEMPLATES_DIR);

    exec('pnpm install --ignore-scripts', outputDir);
    exec('pnpm exec tsc --noEmit', outputDir);
  }, 120_000);

  it('cli-app: installs and builds successfully', async () => {
    const config = makeConfig({ outputDir, projectType: 'cli-app' });
    await generate(config, registry, TEMPLATES_DIR);

    exec('pnpm install --ignore-scripts', outputDir);
    exec('pnpm exec tsc --noEmit', outputDir);
  }, 120_000);

  it('microservice: installs and type-checks with transport recipe', async () => {
    // microservice main.ts imports @nestjs/microservices which is provided
    // by transport recipes (e.g. rabbitmq), so we include one to get the dep
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      recipes: ['rabbitmq'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    exec('pnpm install --ignore-scripts', outputDir);
    exec('pnpm exec tsc --noEmit', outputDir);
  }, 120_000);

  it('scheduled-worker: installs and builds successfully', async () => {
    const config = makeConfig({ outputDir, projectType: 'scheduled-worker' });
    await generate(config, registry, TEMPLATES_DIR);

    exec('pnpm install --ignore-scripts', outputDir);
    exec('pnpm exec tsc --noEmit', outputDir);
  }, 120_000);

  it('http-api with recipes: swagger, pino, and health-checks deps are installable', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'http-api',
      recipes: ['swagger', 'pino', 'health-checks'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    exec('pnpm install --ignore-scripts', outputDir);

    expect(fs.existsSync(path.join(outputDir, 'node_modules', '@nestjs', 'swagger'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'node_modules', 'nestjs-pino'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'node_modules', '@nestjs', 'terminus'))).toBe(true);

    exec('pnpm exec tsc --noEmit', outputDir);
  }, 120_000);
});
