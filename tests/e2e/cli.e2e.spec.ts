import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig } from '@spoonfeed/types';

jest.setTimeout(120000);

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

describe('CLI generator E2E', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate and type-check http-api with swagger + pino + health-checks', async () => {
    const outputDir = path.join(tmpDir, 'http-api');
    const config = makeConfig({
      projectType: 'http-api',
      recipes: ['swagger', 'pino', 'health-checks'],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);

    execSync('pnpm install', { cwd: outputDir, stdio: 'pipe', timeout: 90_000 });
    execSync('pnpm exec tsc --noEmit', { cwd: outputDir, stdio: 'pipe', timeout: 30_000 });
  });

  it('should generate and type-check aws-lambda with pino', async () => {
    const outputDir = path.join(tmpDir, 'aws-lambda');
    const config = makeConfig({
      projectType: 'aws-lambda',
      recipes: ['pino'],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);

    execSync('pnpm install', { cwd: outputDir, stdio: 'pipe', timeout: 90_000 });
    execSync('pnpm exec tsc --noEmit', { cwd: outputDir, stdio: 'pipe', timeout: 30_000 });
  });

  it('should generate and type-check cli-app (bare)', async () => {
    const outputDir = path.join(tmpDir, 'cli-app');
    const config = makeConfig({
      projectType: 'cli-app',
      recipes: [],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);

    execSync('pnpm install', { cwd: outputDir, stdio: 'pipe', timeout: 90_000 });
    execSync('pnpm exec tsc --noEmit', { cwd: outputDir, stdio: 'pipe', timeout: 30_000 });
  });

  it('should generate and type-check microservice with rabbitmq', async () => {
    const outputDir = path.join(tmpDir, 'microservice');
    const config = makeConfig({
      projectType: 'microservice',
      transportLayer: 'rabbitmq',
      recipes: ['rabbitmq', 'pino'],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);

    execSync('pnpm install', { cwd: outputDir, stdio: 'pipe', timeout: 90_000 });
    execSync('pnpm exec tsc --noEmit', { cwd: outputDir, stdio: 'pipe', timeout: 30_000 });
  });

  it('should generate and type-check scheduled-worker with pino', async () => {
    const outputDir = path.join(tmpDir, 'scheduled-worker');
    const config = makeConfig({
      projectType: 'scheduled-worker',
      recipes: ['pino'],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);

    execSync('pnpm install', { cwd: outputDir, stdio: 'pipe', timeout: 90_000 });
    execSync('pnpm exec tsc --noEmit', { cwd: outputDir, stdio: 'pipe', timeout: 30_000 });
  });

  it('should generate and type-check http-api with aws cloud recipes', async () => {
    const outputDir = path.join(tmpDir, 'http-api-aws');
    const config = makeConfig({
      projectType: 'http-api',
      cloudProvider: 'aws',
      recipes: ['pino', 'aws-sqs', 'aws-secrets-manager', 'aws-s3'],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);

    execSync('pnpm install', { cwd: outputDir, stdio: 'pipe', timeout: 90_000 });
    execSync('pnpm exec tsc --noEmit', { cwd: outputDir, stdio: 'pipe', timeout: 30_000 });
  });

  it('should generate http-api with swagger+pino+health-checks, build, and start successfully', async () => {
    const outputDir = path.join(tmpDir, 'http-api-startup');
    const config = makeConfig({
      projectType: 'http-api',
      recipes: ['swagger', 'pino', 'health-checks'],
      outputDir,
    });

    await generate(config, createRegistry(), TEMPLATES_DIR);

    execSync('pnpm install', { cwd: outputDir, stdio: 'pipe', timeout: 90_000 });
    execSync('pnpm build', { cwd: outputDir, stdio: 'pipe', timeout: 30_000 });

    const child = spawn('node', ['dist/main.js'], {
      cwd: outputDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '0', NODE_ENV: 'production' },
    });

    try {
      const output = await new Promise<string>((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const timeout = setTimeout(() => {
          reject(new Error(`App did not start within 5s.\nstdout: ${stdout}\nstderr: ${stderr}`));
        }, 5_000);

        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
          if (stdout.includes('running on')) {
            clearTimeout(timeout);
            resolve(stdout);
          }
        });

        child.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        child.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        child.on('exit', (code) => {
          clearTimeout(timeout);
          if (!stdout.includes('running on')) {
            reject(
              new Error(
                `App exited with code ${code} before starting.\nstdout: ${stdout}\nstderr: ${stderr}`,
              ),
            );
          }
        });
      });

      expect(output).toContain('running on');
    } finally {
      child.kill('SIGTERM');
    }
  });
});
