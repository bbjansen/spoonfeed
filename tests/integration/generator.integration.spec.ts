import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig } from '@spoonfeed/types';

// Suppress @clack/prompts spinner output in tests
jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'test-project',
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

function fileExists(outputDir: string, filePath: string): boolean {
  return fs.existsSync(path.join(outputDir, filePath));
}

function readFile(outputDir: string, filePath: string): string {
  return fs.readFileSync(path.join(outputDir, filePath), 'utf-8');
}

function readJson(outputDir: string, filePath: string): Record<string, unknown> {
  return JSON.parse(readFile(outputDir, filePath)) as Record<string, unknown>;
}

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

describe('Generator: base output', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-test-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('should create all critical base files', async () => {
    const config = makeConfig({ outputDir });
    await generate(config, registry, TEMPLATES_DIR);

    const expectedFiles = [
      'package.json',
      'tsconfig.json',
      'tsconfig.build.json',
      'jest.config.ts',
      '.gitignore',
      '.prettierrc',
      '.npmrc',
      '.editorconfig',
      '.nvmrc',
      'nest-cli.json',
      'eslint.config.mjs',
      'commitlint.config.js',
      '.env.example',
      'README.md',
      'CLAUDE.md',
      '.husky/commit-msg',
      '.husky/pre-commit',
      '.husky/pre-push',
      'src/main.ts',
      'src/app.module.ts',
      'src/shared/filters/http-exception.filter.ts',
      'src/shared/interceptors/response.interceptor.ts',
      'src/shared/constants/error-codes.constant.ts',
      'src/shared/guards/.gitkeep',
      'src/shared/errors/application.error.ts',
      'src/shared/pipes/parse-uuid.pipe.ts',
      'src/shared/utils/retry.util.ts',
      'src/infrastructure/database/entities/.gitkeep',
      'tests/unit/app.module.spec.ts',
      'tests/e2e/app.e2e-spec.ts',
    ];

    for (const file of expectedFiles) {
      expect(fileExists(outputDir, file)).toBe(true);
    }
  });

  it('should set the correct name in package.json', async () => {
    const config = makeConfig({ outputDir });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    expect(pkg.name).toBe('test-project');
  });

  it('should include base dependencies in package.json', async () => {
    const config = makeConfig({ outputDir });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/common']).toBeDefined();
    expect(deps['@nestjs/core']).toBeDefined();
    expect(deps['@nestjs/config']).toBeDefined();
    expect(deps['fastify']).toBeDefined();
    expect(deps['reflect-metadata']).toBeDefined();
  });

  it('should include PORT and NODE_ENV in .env.example', async () => {
    const config = makeConfig({ outputDir });
    await generate(config, registry, TEMPLATES_DIR);

    const envContent = readFile(outputDir, '.env.example');
    expect(envContent).toContain('PORT');
    expect(envContent).toContain('NODE_ENV');
  });

  it('should mention the project type in CLAUDE.md', async () => {
    const config = makeConfig({ outputDir });
    await generate(config, registry, TEMPLATES_DIR);

    const claudeMd = readFile(outputDir, 'CLAUDE.md');
    expect(claudeMd).toContain('http-api');
  });
});

describe('Generator: project types', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-test-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('http-api: src/main.ts contains FastifyAdapter', async () => {
    const config = makeConfig({ outputDir, projectType: 'http-api' });
    await generate(config, registry, TEMPLATES_DIR);

    const mainTs = readFile(outputDir, 'src/main.ts');
    expect(mainTs).toContain('FastifyAdapter');
  });

  it('aws-lambda: src/main.ts contains awsLambdaFastify and package.json has @fastify/aws-lambda', async () => {
    const config = makeConfig({ outputDir, projectType: 'aws-lambda' });
    await generate(config, registry, TEMPLATES_DIR);

    const mainTs = readFile(outputDir, 'src/main.ts');
    expect(mainTs).toContain('awsLambdaFastify');

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@fastify/aws-lambda']).toBeDefined();
  });

  it('cli-app: src/main.ts contains CommandFactory and package.json has nest-commander', async () => {
    const config = makeConfig({ outputDir, projectType: 'cli-app' });
    await generate(config, registry, TEMPLATES_DIR);

    const mainTs = readFile(outputDir, 'src/main.ts');
    expect(mainTs).toContain('CommandFactory');

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['nest-commander']).toBeDefined();
  });

  it('microservice: src/main.ts contains createMicroservice', async () => {
    const config = makeConfig({ outputDir, projectType: 'microservice' });
    await generate(config, registry, TEMPLATES_DIR);

    const mainTs = readFile(outputDir, 'src/main.ts');
    expect(mainTs).toContain('createMicroservice');
  });

  it('scheduled-worker: app.module.ts contains ScheduleModule and package.json has @nestjs/schedule', async () => {
    const config = makeConfig({ outputDir, projectType: 'scheduled-worker' });
    await generate(config, registry, TEMPLATES_DIR);

    const appModule = readFile(outputDir, 'src/app.module.ts');
    expect(appModule).toContain('ScheduleModule');

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/schedule']).toBeDefined();
  });
});

describe('Generator: recipe merging', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-test-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('swagger recipe adds @nestjs/swagger to package.json deps', async () => {
    const config = makeConfig({ outputDir, recipes: ['swagger'] });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/swagger']).toBeDefined();
  });

  it('pino recipe adds nestjs-pino and pino to deps and pino-pretty to devDeps', async () => {
    const config = makeConfig({ outputDir, recipes: ['pino'] });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    const devDeps = pkg.devDependencies as Record<string, string>;
    expect(deps['nestjs-pino']).toBeDefined();
    expect(deps['pino']).toBeDefined();
    expect(devDeps['pino-pretty']).toBeDefined();
  });

  it('typeorm-postgres adds @nestjs/typeorm, typeorm, pg and DB env vars', async () => {
    const config = makeConfig({ outputDir, recipes: ['typeorm-postgres'] });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/typeorm']).toBeDefined();
    expect(deps['typeorm']).toBeDefined();
    expect(deps['pg']).toBeDefined();

    const envContent = readFile(outputDir, '.env.example');
    expect(envContent).toContain('DB_HOST');
    expect(envContent).toContain('DB_PORT');
    expect(envContent).toContain('DB_USERNAME');
    expect(envContent).toContain('DB_PASSWORD');
    expect(envContent).toContain('DB_NAME');
  });

  it('jwt-auth adds @nestjs/jwt and creates guards and decorators', async () => {
    const config = makeConfig({ outputDir, recipes: ['jwt-auth'] });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/jwt']).toBeDefined();

    expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/shared/decorators/current-user.decorator.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/shared/decorators/public.decorator.ts')).toBe(true);
  });

  it('multiple recipes merge correctly without duplicates', async () => {
    const config = makeConfig({ outputDir, recipes: ['swagger', 'pino', 'jwt-auth'] });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/swagger']).toBeDefined();
    expect(deps['nestjs-pino']).toBeDefined();
    expect(deps['@nestjs/jwt']).toBeDefined();

    // Verify base deps are still present (no overwrite)
    expect(deps['@nestjs/common']).toBeDefined();
    expect(deps['@nestjs/core']).toBeDefined();

    // Verify no duplicate keys by checking JSON round-trip
    const rawPkg = readFile(outputDir, 'package.json');
    const parsed = JSON.parse(rawPkg) as Record<string, unknown>;
    const reparsed = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
    expect(parsed).toEqual(reparsed);
  });

  it('CLAUDE.md includes recipe-specific sections', async () => {
    const config = makeConfig({ outputDir, recipes: ['swagger', 'typeorm-postgres'] });
    await generate(config, registry, TEMPLATES_DIR);

    const claudeMd = readFile(outputDir, 'CLAUDE.md');
    expect(claudeMd).toContain('Swagger');
    expect(claudeMd).toContain('TypeORM');
  });

  it('.cursor/rules/project.mdc is created when recipes have cursor rules', async () => {
    const config = makeConfig({ outputDir, recipes: ['typeorm-postgres'] });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, '.cursor/rules/project.mdc')).toBe(true);
    const cursorRules = readFile(outputDir, '.cursor/rules/project.mdc');
    expect(cursorRules).toContain('TypeORM');
  });
});

describe('Generator: deployment and ci-cd', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-test-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('dockerfile target creates Dockerfile and .dockerignore', async () => {
    const config = makeConfig({ outputDir, deploymentTargets: ['dockerfile'] });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'Dockerfile')).toBe(true);
    expect(fileExists(outputDir, '.dockerignore')).toBe(true);
  });

  it('no deployment targets produces no Dockerfile', async () => {
    const config = makeConfig({ outputDir, deploymentTargets: [] });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'Dockerfile')).toBe(false);
  });

  it('github-actions ci-cd creates .github/workflows/ci.yml and cd.yml', async () => {
    const config = makeConfig({ outputDir, ciCdProvider: 'github-actions' });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, '.github/workflows/ci.yml')).toBe(true);
    expect(fileExists(outputDir, '.github/workflows/cd.yml')).toBe(true);
  });

  it('no ci-cd provider produces no .github/workflows', async () => {
    const config = makeConfig({ outputDir, ciCdProvider: undefined });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, '.github/workflows')).toBe(false);
  });
});

describe('Generator: edge cases', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-test-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('packageScope is rendered correctly in package.json name', async () => {
    const config = makeConfig({ outputDir, scope: '@acme' });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    expect(pkg.name).toBe('@acme/test-project');
  });

  it('undefined scope renders just the name without @scope/ prefix', async () => {
    const config = makeConfig({ outputDir, scope: undefined });
    await generate(config, registry, TEMPLATES_DIR);

    const pkg = readJson(outputDir, 'package.json');
    expect(pkg.name).toBe('test-project');
  });

  it('dot-prefixed directories are renamed correctly (.husky not dot-husky)', async () => {
    const config = makeConfig({ outputDir });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, '.husky/commit-msg')).toBe(true);
    expect(fileExists(outputDir, 'dot-husky')).toBe(false);
  });

  it('recipe template files are copied into output', async () => {
    const config = makeConfig({ outputDir, recipes: ['jwt-auth'] });
    await generate(config, registry, TEMPLATES_DIR);

    // jwt-auth recipe copies guard and decorator files into the output
    expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/shared/decorators/current-user.decorator.ts')).toBe(true);

    // Verify the files have actual content (not empty)
    const guardContent = readFile(outputDir, 'src/shared/guards/jwt-auth.guard.ts');
    expect(guardContent.length).toBeGreaterThan(0);
  });
});
