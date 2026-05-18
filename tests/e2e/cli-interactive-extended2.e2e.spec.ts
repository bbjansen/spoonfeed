import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { runAllPrompts } from '@spoonfeed/prompts/run-all';
import { validateConfig } from '@spoonfeed/validation/config-validator';
import { detectConflicts } from '@spoonfeed/validation/conflict-detector';
import type {
  ProjectConfig,
  ProjectType,
  TransportLayer,
  FrontendFramework,
  CloudProvider,
  CiCdProvider,
  RecipeId,
} from '@spoonfeed/types';

jest.setTimeout(30_000);

// ─── Mock @clack/prompts ─────────────────────────────────────────────────────

const mockText = jest.fn();
const mockSelect = jest.fn();
const mockMultiselect = jest.fn();
const mockConfirm = jest.fn();

jest.mock('@clack/prompts', () => ({
  text: (...args: unknown[]) => mockText(...args),
  select: (...args: unknown[]) => mockSelect(...args),
  multiselect: (...args: unknown[]) => mockMultiselect(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  intro: jest.fn(),
  outro: jest.fn(),
  note: jest.fn(),
  cancel: jest.fn(),
  log: { info: jest.fn(), warning: jest.fn(), error: jest.fn() },
  isCancel: jest.fn().mockReturnValue(false),
}));

jest.mock('execa', () => ({
  execa: jest.fn().mockResolvedValue({ stdout: '', stderr: '' }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function createRegistry(): RecipeRegistry {
  const r = new RecipeRegistry();
  registerAllRecipes(r);
  return r;
}

function makeConfig(overrides: Partial<ProjectConfig>): ProjectConfig {
  return {
    name: 'test-project',
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

function readJsonFile(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function dirExists(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function configurePromptMocks(opts: {
  name: string;
  scope?: string;
  projectType: ProjectType;
  cloudProvider: CloudProvider;
  transportLayer?: TransportLayer;
  frontendFramework?: FrontendFramework;
  recipes: RecipeId[];
  deploymentTargets: string[];
  ciCdProvider: CiCdProvider | 'none';
}): void {
  mockText.mockReset();
  mockSelect.mockReset();
  mockMultiselect.mockReset();
  mockConfirm.mockReset();

  mockText.mockResolvedValueOnce(opts.name);
  mockText.mockResolvedValueOnce(opts.scope ?? '');
  mockSelect.mockResolvedValueOnce(opts.projectType);
  mockSelect.mockResolvedValueOnce(opts.cloudProvider);

  const httpTypes = new Set(['http-api', 'aws-lambda', 'full-stack', 'monorepo']);
  if (httpTypes.has(opts.projectType)) {
    mockSelect.mockResolvedValueOnce('fastify');
  }

  if (opts.projectType === 'microservice' && opts.transportLayer) {
    mockSelect.mockResolvedValueOnce(opts.transportLayer);
  }
  if (opts.projectType === 'full-stack' && opts.frontendFramework) {
    mockSelect.mockResolvedValueOnce(opts.frontendFramework);
  }

  mockMultiselect.mockResolvedValueOnce(opts.recipes);
  mockMultiselect.mockResolvedValueOnce(opts.deploymentTargets);
  mockSelect.mockResolvedValueOnce(opts.ciCdProvider);
  mockConfirm.mockResolvedValueOnce(true);
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('CLI interactive E2E (extended2)', () => {
  let tmpDir: string;
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ext2-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 32. MAIN.TS CONTENT PER PROJECT TYPE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('32. Main.ts Content per Project Type', () => {
    it('should generate http-api main.ts with FastifyAdapter', async () => {
      const outputDir = path.join(tmpDir, 'main-http-fastify');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('FastifyAdapter');
    });

    it('should generate http-api main.ts with NestFactory.create', async () => {
      const outputDir = path.join(tmpDir, 'main-http-nestfactory');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('NestFactory.create');
    });

    it('should generate http-api main.ts with ValidationPipe', async () => {
      const outputDir = path.join(tmpDir, 'main-http-validation');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('ValidationPipe');
    });

    it('should generate http-api main.ts with app.listen()', async () => {
      const outputDir = path.join(tmpDir, 'main-http-listen');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('app.listen');
    });

    it('should generate microservice main.ts with createMicroservice', async () => {
      const outputDir = path.join(tmpDir, 'main-ms-create');
      await generate(makeConfig({ name: 'my-ms', projectType: 'microservice', transportLayer: 'tcp', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('createMicroservice');
    });

    it('should generate microservice main.ts with MicroserviceOptions', async () => {
      const outputDir = path.join(tmpDir, 'main-ms-options');
      await generate(makeConfig({ name: 'my-ms', projectType: 'microservice', transportLayer: 'rabbitmq', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('MicroserviceOptions');
    });

    it('should generate cli-app main.ts with CommandFactory', async () => {
      const outputDir = path.join(tmpDir, 'main-cli-cmdfactory');
      await generate(makeConfig({ name: 'my-cli', projectType: 'cli-app', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('CommandFactory');
    });

    it('should generate aws-lambda main.ts with handler export', async () => {
      const outputDir = path.join(tmpDir, 'main-lambda-handler');
      await generate(makeConfig({ name: 'my-fn', projectType: 'aws-lambda', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('export const handler');
    });

    it('should generate aws-lambda main.ts with awsLambdaFastify', async () => {
      const outputDir = path.join(tmpDir, 'main-lambda-awsfastify');
      await generate(makeConfig({ name: 'my-fn', projectType: 'aws-lambda', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('awsLambdaFastify');
    });

    it('should generate scheduled-worker main.ts with createApplicationContext', async () => {
      const outputDir = path.join(tmpDir, 'main-worker-ctx');
      await generate(makeConfig({ name: 'my-worker', projectType: 'scheduled-worker', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('createApplicationContext');
    });

    it('should generate monorepo main.ts under apps/api/src/', async () => {
      const outputDir = path.join(tmpDir, 'main-mono-location');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'apps', 'api', 'src', 'main.ts'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'src', 'main.ts'))).toBe(false);
    });

    it('should generate full-stack main.ts under apps/api/src/', async () => {
      const outputDir = path.join(tmpDir, 'main-fs-location');
      await generate(makeConfig({ name: 'my-fs', projectType: 'full-stack', frontendFramework: 'nextjs', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'apps', 'api', 'src', 'main.ts'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'src', 'main.ts'))).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 33. PACKAGE.JSON SCRIPTS PER PROJECT TYPE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('33. Package.json Scripts Verification', () => {
    it('should include test:unit script for http-api', async () => {
      const outputDir = path.join(tmpDir, 'scripts-unit');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('test:unit');
    });

    it('should include test:integration script', async () => {
      const outputDir = path.join(tmpDir, 'scripts-integration');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('test:integration');
    });

    it('should include test:all script', async () => {
      const outputDir = path.join(tmpDir, 'scripts-testall');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('test:all');
    });

    it('should include test:watch script', async () => {
      const outputDir = path.join(tmpDir, 'scripts-testwatch');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('test:watch');
    });

    it('should include start:debug script', async () => {
      const outputDir = path.join(tmpDir, 'scripts-debug');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('start:debug');
    });

    it('should include prepare script (husky)', async () => {
      const outputDir = path.join(tmpDir, 'scripts-prepare');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('prepare');
      expect(scripts['prepare']).toContain('husky');
    });

    it('should include start script', async () => {
      const outputDir = path.join(tmpDir, 'scripts-start');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('start');
    });

    it('should have build script that uses nest build', async () => {
      const outputDir = path.join(tmpDir, 'scripts-build-nest');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['build']).toContain('nest build');
    });

    it('should include start:dev script for scheduled-worker', async () => {
      const outputDir = path.join(tmpDir, 'scripts-worker-dev');
      await generate(makeConfig({ name: 'my-worker', projectType: 'scheduled-worker', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('start:dev');
    });

    it('should include build script for microservice', async () => {
      const outputDir = path.join(tmpDir, 'scripts-ms-build');
      await generate(makeConfig({ name: 'my-ms', projectType: 'microservice', transportLayer: 'tcp', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('build');
    });

    it('should include format script that uses prettier', async () => {
      const outputDir = path.join(tmpDir, 'scripts-prettier');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['format']).toContain('prettier');
    });

    it('should include lint script that uses eslint', async () => {
      const outputDir = path.join(tmpDir, 'scripts-eslint');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['lint']).toContain('eslint');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 34. RECIPE DEPENDENCIES IN PACKAGE.JSON
  // ═══════════════════════════════════════════════════════════════════════════

  describe('34. Recipe Dependencies in package.json', () => {
    it('should add amqplib for rabbitmq recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-rabbitmq-amqp');
      await generate(makeConfig({ name: 'my-api', recipes: ['rabbitmq'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('amqplib');
    });

    it('should add bullmq for bullmq recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-bullmq');
      await generate(makeConfig({ name: 'my-api', recipes: ['bullmq'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('bullmq');
    });

    it('should add @nestjs/cache-manager for redis-cache recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-redis-cache');
      await generate(makeConfig({ name: 'my-api', recipes: ['redis-cache'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/cache-manager');
    });

    it('should add @nestjs/terminus for health-checks recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-terminus');
      await generate(makeConfig({ name: 'my-api', recipes: ['health-checks'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/terminus');
    });

    it('should add prom-client for prometheus recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-prom-client');
      await generate(makeConfig({ name: 'my-api', recipes: ['prometheus'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('prom-client');
    });

    it('should add nestjs-pino for pino recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-nestjs-pino');
      await generate(makeConfig({ name: 'my-api', recipes: ['pino'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('nestjs-pino');
    });

    it('should add pino as a dependency for pino recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-pino-core');
      await generate(makeConfig({ name: 'my-api', recipes: ['pino'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('pino');
    });

    it('should add @sentry/nestjs for sentry recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-sentry');
      await generate(makeConfig({ name: 'my-api', recipes: ['sentry'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@sentry/nestjs');
    });

    it('should add @opentelemetry/sdk-node for opentelemetry recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-otel');
      await generate(makeConfig({ name: 'my-api', recipes: ['opentelemetry'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@opentelemetry/sdk-node');
    });

    it('should add @nestjs/throttler for throttler recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-throttler');
      await generate(makeConfig({ name: 'my-api', recipes: ['throttler'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/throttler');
    });

    it('should add @nestjs/websockets for websockets recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-websockets');
      await generate(makeConfig({ name: 'my-api', recipes: ['websockets'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/websockets');
    });

    it('should add @nestjs/graphql for graphql-mercurius recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-graphql');
      await generate(makeConfig({ name: 'my-api', recipes: ['graphql-mercurius'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/graphql');
    });

    it('should add @nestjs/cqrs for cqrs recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-cqrs');
      await generate(makeConfig({ name: 'my-api', recipes: ['cqrs'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/cqrs');
    });

    it('should add nestjs-i18n for i18n recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-i18n');
      await generate(makeConfig({ name: 'my-api', recipes: ['i18n'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('nestjs-i18n');
    });

    it('should add opossum for circuit-breaker recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-opossum');
      await generate(makeConfig({ name: 'my-api', recipes: ['circuit-breaker'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('opossum');
    });

    it('should add @nestjs/swagger for swagger recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-swagger');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/swagger');
    });

    it('should add @nestjs/jwt for jwt-auth recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-jwt');
      await generate(makeConfig({ name: 'my-api', recipes: ['jwt-auth'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/jwt');
    });

    it('should add @nestjs/passport for passport recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-passport');
      await generate(makeConfig({ name: 'my-api', recipes: ['passport'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/passport');
    });

    it('should add kysely for kysely recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-kysely');
      await generate(makeConfig({ name: 'my-api', recipes: ['kysely'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('kysely');
    });

    it('should add @mikro-orm/core for mikro-orm recipe', async () => {
      const outputDir = path.join(tmpDir, 'dep-mikroorm');
      await generate(makeConfig({ name: 'my-api', recipes: ['mikro-orm'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@mikro-orm/core');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 35. DEPLOYMENT TARGET FILE CONTENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('35. Deployment Target File Content', () => {
    it('should generate Dockerfile with FROM node:22-alpine', async () => {
      const outputDir = path.join(tmpDir, 'deploy-dockerfile-content');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['dockerfile'], outputDir }), registry, TEMPLATES_DIR);
      const dockerfile = readTextFile(path.join(outputDir, 'Dockerfile'));
      expect(dockerfile).toContain('FROM node:22-alpine');
    });

    it('should generate Dockerfile with pnpm', async () => {
      const outputDir = path.join(tmpDir, 'deploy-dockerfile-pnpm');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['dockerfile'], outputDir }), registry, TEMPLATES_DIR);
      const dockerfile = readTextFile(path.join(outputDir, 'Dockerfile'));
      expect(dockerfile).toContain('pnpm');
    });

    it('should generate .dockerignore with dockerfile target', async () => {
      const outputDir = path.join(tmpDir, 'deploy-dockerignore');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['dockerfile'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, '.dockerignore'))).toBe(true);
    });

    it('should generate docker-compose.yml with services: key', async () => {
      const outputDir = path.join(tmpDir, 'deploy-compose-content');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['docker-compose'], outputDir }), registry, TEMPLATES_DIR);
      const compose = readTextFile(path.join(outputDir, 'docker-compose.yml'));
      expect(compose).toContain('services:');
    });

    it('should generate k8s/deployment.yaml', async () => {
      const outputDir = path.join(tmpDir, 'deploy-k8s-deploy');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['kubernetes'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'k8s', 'deployment.yaml'))).toBe(true);
    });

    it('should generate k8s/service.yaml', async () => {
      const outputDir = path.join(tmpDir, 'deploy-k8s-svc');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['kubernetes'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'k8s', 'service.yaml'))).toBe(true);
    });

    it('should generate k8s/ingress.yaml', async () => {
      const outputDir = path.join(tmpDir, 'deploy-k8s-ingress');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['kubernetes'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'k8s', 'ingress.yaml'))).toBe(true);
    });

    it('should generate k8s/deployment.yaml with apiVersion: apps/v1', async () => {
      const outputDir = path.join(tmpDir, 'deploy-k8s-apiversion');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['kubernetes'], outputDir }), registry, TEMPLATES_DIR);
      const deploy = readTextFile(path.join(outputDir, 'k8s', 'deployment.yaml'));
      expect(deploy).toContain('apiVersion: apps/v1');
    });

    it('should generate .github/workflows/ci.yml for github-actions', async () => {
      const outputDir = path.join(tmpDir, 'deploy-gha-ci');
      await generate(makeConfig({ name: 'my-api', ciCdProvider: 'github-actions', outputDir }), registry, TEMPLATES_DIR);
      const ciyml = readTextFile(path.join(outputDir, '.github', 'workflows', 'ci.yml'));
      expect(ciyml).toContain('on:');
    });

    it('should generate azure-pipelines.yml with trigger:', async () => {
      const outputDir = path.join(tmpDir, 'deploy-azure-pipelines');
      await generate(makeConfig({ name: 'my-api', ciCdProvider: 'azure-devops', outputDir }), registry, TEMPLATES_DIR);
      const pipeline = readTextFile(path.join(outputDir, 'azure-pipelines.yml'));
      expect(pipeline).toContain('trigger:');
    });

    it('should generate buildspec.yml for aws-codepipeline', async () => {
      const outputDir = path.join(tmpDir, 'deploy-codepipeline');
      await generate(makeConfig({ name: 'my-api', ciCdProvider: 'aws-codepipeline', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'buildspec.yml'))).toBe(true);
    });

    it('should generate cloudbuild.yaml for gcp-cloudbuild', async () => {
      const outputDir = path.join(tmpDir, 'deploy-cloudbuild');
      await generate(makeConfig({ name: 'my-api', ciCdProvider: 'gcp-cloudbuild', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'cloudbuild.yaml'))).toBe(true);
    });

    it('should generate serverless.yml for serverless-framework', async () => {
      const outputDir = path.join(tmpDir, 'deploy-serverless');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['serverless-framework'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'serverless.yml'))).toBe(true);
    });

    it('should generate main.tf for terraform', async () => {
      const outputDir = path.join(tmpDir, 'deploy-terraform');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['terraform'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'main.tf'))).toBe(true);
    });

    it('should generate .github/workflows/cd.yml for github-actions', async () => {
      const outputDir = path.join(tmpDir, 'deploy-gha-cd');
      await generate(makeConfig({ name: 'my-api', ciCdProvider: 'github-actions', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, '.github', 'workflows', 'cd.yml'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 36. AWS RECIPE ENV VARS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('36. AWS Recipe Env Vars', () => {
    it('should add SQS_QUEUE_URL for aws-sqs recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-sqs-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-sqs'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SQS_QUEUE_URL');
    });

    it('should add SNS_TOPIC_ARN for aws-sns recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-sns-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-sns'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SNS_TOPIC_ARN');
    });

    it('should add COGNITO_USER_POOL_ID for aws-cognito recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-cognito-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-cognito'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('COGNITO_USER_POOL_ID');
    });

    it('should add COGNITO_CLIENT_ID for aws-cognito recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-cognito-client');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-cognito'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('COGNITO_CLIENT_ID');
    });

    it('should add DYNAMODB_TABLE_NAME for aws-dynamodb recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-dynamo-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-dynamodb'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('DYNAMODB_TABLE_NAME');
    });

    it('should add RDS_HOST for aws-rds recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-rds-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-rds'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('RDS_HOST');
      expect(env).toContain('RDS_PASSWORD');
    });

    it('should add ELASTICACHE_ENDPOINT for aws-elasticache recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-elasticache-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-elasticache'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('ELASTICACHE_ENDPOINT');
    });

    it('should add SSM_PREFIX for aws-ssm recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-ssm-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-ssm'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SSM_PREFIX');
    });

    it('should add CLOUDWATCH_LOG_GROUP for aws-cloudwatch recipe', async () => {
      const outputDir = path.join(tmpDir, 'aws-cloudwatch-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-cloudwatch'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('CLOUDWATCH_LOG_GROUP');
    });

    it('should add AWS_REGION for all AWS recipes', async () => {
      const outputDir = path.join(tmpDir, 'aws-region-all');
      await generate(
        makeConfig({ name: 'my-api', cloudProvider: 'aws', recipes: ['aws-sqs', 'aws-sns', 'aws-secrets-manager'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AWS_REGION');
    });

    it('should include aws-secrets-manager env vars (AWS_REGION)', async () => {
      const outputDir = path.join(tmpDir, 'aws-secretsmgr-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['aws-secrets-manager'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AWS_REGION');
    });

    it('should have AWS_REGION in .env.example for aws cloud provider', async () => {
      const outputDir = path.join(tmpDir, 'aws-cloud-region');
      await generate(
        makeConfig({ name: 'my-api', cloudProvider: 'aws', recipes: ['aws-s3'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AWS_REGION');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 37. GCP RECIPE ENV VARS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('37. GCP Recipe Env Vars', () => {
    it('should add PUBSUB_TOPIC for gcp-pubsub recipe', async () => {
      const outputDir = path.join(tmpDir, 'gcp-pubsub-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-pubsub'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('PUBSUB_TOPIC');
    });

    it('should add PUBSUB_SUBSCRIPTION for gcp-pubsub recipe', async () => {
      const outputDir = path.join(tmpDir, 'gcp-pubsub-sub');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-pubsub'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('PUBSUB_SUBSCRIPTION');
    });

    it('should add GCP_PROJECT_ID for gcp-cloud-sql recipe', async () => {
      const outputDir = path.join(tmpDir, 'gcp-sql-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-cloud-sql'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('GCP_PROJECT_ID');
      expect(env).toContain('CLOUD_SQL_CONNECTION_NAME');
    });

    it('should add FIRESTORE_DATABASE_ID for gcp-firestore recipe', async () => {
      const outputDir = path.join(tmpDir, 'gcp-firestore-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-firestore'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('FIRESTORE_DATABASE_ID');
    });

    it('should add MEMORYSTORE_HOST for gcp-memorystore recipe', async () => {
      const outputDir = path.join(tmpDir, 'gcp-memorystore-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-memorystore'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('MEMORYSTORE_HOST');
    });

    it('should add GOOGLE_APPLICATION_CREDENTIALS for gcp-firebase-auth', async () => {
      const outputDir = path.join(tmpDir, 'gcp-firebase-creds');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-firebase-auth'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('GOOGLE_APPLICATION_CREDENTIALS');
    });

    it('should add GCP_LOG_NAME for gcp-cloud-logging recipe', async () => {
      const outputDir = path.join(tmpDir, 'gcp-logging-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-cloud-logging'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('GCP_LOG_NAME');
    });

    it('should add GCS_BUCKET for gcp-cloud-storage recipe', async () => {
      const outputDir = path.join(tmpDir, 'gcp-gcs-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-cloud-storage'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('GCS_BUCKET');
    });

    it('should have GCP_PROJECT_ID in .env.example for gcp cloud provider', async () => {
      const outputDir = path.join(tmpDir, 'gcp-cloud-project');
      await generate(
        makeConfig({ name: 'my-api', cloudProvider: 'gcp', recipes: ['gcp-secret-manager', 'gcp-cloud-storage'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('GCP_PROJECT_ID');
    });

    it('should add CDN_SIGNING_KEY for gcp-cloud-cdn recipe', async () => {
      const outputDir = path.join(tmpDir, 'gcp-cdn-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['gcp-cloud-cdn'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('CDN_SIGNING_KEY');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 38. AZURE RECIPE ENV VARS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('38. Azure Recipe Env Vars', () => {
    it('should add AZURE_SERVICE_BUS_CONNECTION_STRING for azure-service-bus recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-servicebus-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-service-bus'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_SERVICE_BUS_CONNECTION_STRING');
    });

    it('should add AZURE_KEY_VAULT_URL for azure-key-vault recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-keyvault-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-key-vault'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_KEY_VAULT_URL');
    });

    it('should add AZURE_TENANT_ID for azure-entra-id recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-entra-tenant');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-entra-id'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_TENANT_ID');
    });

    it('should add AZURE_CLIENT_ID for azure-entra-id recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-entra-client');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-entra-id'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_CLIENT_ID');
    });

    it('should add AZURE_COSMOS_ENDPOINT for azure-cosmos-db recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-cosmos-endpoint');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-cosmos-db'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_COSMOS_ENDPOINT');
    });

    it('should add AZURE_COSMOS_KEY for azure-cosmos-db recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-cosmos-key');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-cosmos-db'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_COSMOS_KEY');
    });

    it('should add AZURE_SQL_HOST for azure-sql-database recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-sql-host');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-sql-database'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_SQL_HOST');
    });

    it('should add AZURE_REDIS_HOST for azure-cache recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-redis-host');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-cache'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_REDIS_HOST');
    });

    it('should add APPLICATIONINSIGHTS_CONNECTION_STRING for azure-app-insights recipe', async () => {
      const outputDir = path.join(tmpDir, 'azure-appinsights-env');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-app-insights'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('APPLICATIONINSIGHTS_CONNECTION_STRING');
    });

    it('should have AZURE_KEY_VAULT_URL in .env.example for azure cloud provider', async () => {
      const outputDir = path.join(tmpDir, 'azure-cloud-keyvault');
      await generate(
        makeConfig({ name: 'my-api', cloudProvider: 'azure', recipes: ['azure-key-vault', 'azure-blob-storage'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_KEY_VAULT_URL');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 39. MANIFEST STRUCTURE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('39. Manifest Structure Verification', () => {
    it('should set projectType correctly in manifest for http-api', async () => {
      const outputDir = path.join(tmpDir, 'manifest-httpapi');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      expect(manifest.projectType).toBe('http-api');
    });

    it('should set projectType correctly in manifest for microservice', async () => {
      const outputDir = path.join(tmpDir, 'manifest-ms');
      await generate(makeConfig({ name: 'my-ms', projectType: 'microservice', transportLayer: 'tcp', outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      expect(manifest.projectType).toBe('microservice');
    });

    it('should set cloudProvider in manifest', async () => {
      const outputDir = path.join(tmpDir, 'manifest-cloud');
      await generate(makeConfig({ name: 'my-api', cloudProvider: 'aws', outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      expect(manifest.cloudProvider).toBe('aws');
    });

    it('should include spoonfeedVersion in manifest', async () => {
      const outputDir = path.join(tmpDir, 'manifest-version');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      expect(manifest).toHaveProperty('spoonfeedVersion');
    });

    it('should include generatedAt timestamp in manifest', async () => {
      const outputDir = path.join(tmpDir, 'manifest-generatedat');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      expect(manifest).toHaveProperty('generatedAt');
      expect(typeof manifest.generatedAt).toBe('string');
    });

    it('should include recipe entry with installedAt for each installed recipe', async () => {
      const outputDir = path.join(tmpDir, 'manifest-recipe-installed');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger'], outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;
      expect(recipes['swagger']).toHaveProperty('installedAt');
    });

    it('should include recipe entry with version for each installed recipe', async () => {
      const outputDir = path.join(tmpDir, 'manifest-recipe-version');
      await generate(makeConfig({ name: 'my-api', recipes: ['pino'], outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;
      expect(recipes['pino']).toHaveProperty('version');
    });

    it('should include recipe entry with files array', async () => {
      const outputDir = path.join(tmpDir, 'manifest-recipe-files');
      await generate(makeConfig({ name: 'my-api', recipes: ['typeorm-postgres'], outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;
      expect(recipes['typeorm-postgres']).toHaveProperty('files');
      expect(Array.isArray(recipes['typeorm-postgres']['files'])).toBe(true);
    });

    it('should include mainTsBlocks in manifest for swagger recipe', async () => {
      const outputDir = path.join(tmpDir, 'manifest-maints-swagger');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger'], outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;
      expect(recipes['swagger']).toHaveProperty('mainTsBlocks');
    });

    it('should count recipes correctly in manifest when 5 are installed', async () => {
      const outputDir = path.join(tmpDir, 'manifest-count');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['swagger', 'pino', 'health-checks', 'cors', 'helmet'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(recipes)).toHaveLength(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 40. RECIPE REGISTRY API
  // ═══════════════════════════════════════════════════════════════════════════

  describe('40. Recipe Registry API', () => {
    it('should return all recipes from getAll() with correct count (>= 100)', () => {
      const allRecipes = registry.getAll();
      expect(allRecipes.length).toBeGreaterThanOrEqual(100);
    });

    it('should return swagger recipe from get()', () => {
      const swagger = registry.get('swagger');
      expect(swagger).toBeDefined();
      expect(swagger!.id).toBe('swagger');
      expect(swagger!.name).toBeTruthy();
    });

    it('should return typeorm-postgres recipe from get()', () => {
      const recipe = registry.get('typeorm-postgres');
      expect(recipe).toBeDefined();
      expect(recipe!.category).toBe('Database');
    });

    it('should return undefined for non-existent recipe id', () => {
      const recipe = registry.get('non-existent-recipe' as RecipeId);
      expect(recipe).toBeUndefined();
    });

    it('should return recipes compatible with http-api via getCompatibleWith()', () => {
      const compatible = registry.getCompatibleWith('http-api');
      expect(compatible.length).toBeGreaterThan(50);
    });

    it('should return Database category recipes via getByCategory()', () => {
      const dbRecipes = registry.getByCategory('Database');
      expect(dbRecipes.length).toBeGreaterThanOrEqual(7);
      const ids = dbRecipes.map((r) => r.id);
      expect(ids).toContain('typeorm-postgres');
      expect(ids).toContain('prisma');
    });

    it('should return Auth category recipes via getByCategory()', () => {
      const authRecipes = registry.getByCategory('Auth');
      expect(authRecipes.length).toBeGreaterThanOrEqual(5);
    });

    it('should have unique ids for all registered recipes', () => {
      const allRecipes = registry.getAll();
      const ids = allRecipes.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 41. MULTIPLE DEPLOYMENT TARGETS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('41. Multiple Deployment Targets', () => {
    it('should generate dockerfile + kubernetes together', async () => {
      const outputDir = path.join(tmpDir, 'multi-deploy-docker-k8s');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['dockerfile', 'kubernetes'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(true);
      expect(dirExists(path.join(outputDir, 'k8s'))).toBe(true);
    });

    it('should generate dockerfile + docker-compose together', async () => {
      const outputDir = path.join(tmpDir, 'multi-deploy-docker-compose');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['dockerfile', 'docker-compose'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'docker-compose.yml'))).toBe(true);
    });

    it('should generate terraform + kubernetes together', async () => {
      const outputDir = path.join(tmpDir, 'multi-deploy-tf-k8s');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['terraform', 'kubernetes'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'main.tf'))).toBe(true);
      expect(dirExists(path.join(outputDir, 'k8s'))).toBe(true);
    });

    it('should generate all 5 deployment targets for aws-lambda', async () => {
      const outputDir = path.join(tmpDir, 'multi-deploy-all-lambda');
      await generate(
        makeConfig({ name: 'my-fn', projectType: 'aws-lambda', deploymentTargets: ['dockerfile', 'docker-compose', 'kubernetes', 'serverless-framework', 'terraform'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'serverless.yml'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'main.tf'))).toBe(true);
    });

    it('should generate CI/CD + dockerfile together', async () => {
      const outputDir = path.join(tmpDir, 'multi-ci-docker');
      await generate(
        makeConfig({ name: 'my-api', ciCdProvider: 'github-actions', deploymentTargets: ['dockerfile'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, '.github', 'workflows', 'ci.yml'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(true);
    });

    it('should generate CI/CD + kubernetes together', async () => {
      const outputDir = path.join(tmpDir, 'multi-ci-k8s');
      await generate(
        makeConfig({ name: 'my-api', ciCdProvider: 'azure-devops', deploymentTargets: ['kubernetes'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'azure-pipelines.yml'))).toBe(true);
      expect(dirExists(path.join(outputDir, 'k8s'))).toBe(true);
    });

    it('should generate dockerfile + serverless-framework together', async () => {
      const outputDir = path.join(tmpDir, 'multi-docker-serverless');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['dockerfile', 'serverless-framework'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'serverless.yml'))).toBe(true);
    });

    it('should generate all deployment targets + CI/CD for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'multi-mono-deploy');
      await generate(
        makeConfig({ name: 'my-mono', projectType: 'monorepo', deploymentTargets: ['dockerfile', 'docker-compose'], ciCdProvider: 'github-actions', outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(true);
      expect(fileExists(path.join(outputDir, '.github', 'workflows', 'ci.yml'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 42. TRANSPORT LAYER DEPS IN PACKAGE.JSON
  // ═══════════════════════════════════════════════════════════════════════════

  describe('42. Transport Layer Dependencies', () => {
    it('should include @nestjs/microservices for all microservice projects', async () => {
      const outputDir = path.join(tmpDir, 'transport-core-dep');
      await generate(makeConfig({ name: 'my-ms', projectType: 'microservice', transportLayer: 'tcp', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/microservices');
    });

    it('should not include @nestjs/microservices for http-api projects', async () => {
      const outputDir = path.join(tmpDir, 'transport-no-micro');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const allDeps = { ...(pkg.dependencies as Record<string, string>), ...(pkg.devDependencies as Record<string, string>) };
      expect(allDeps).not.toHaveProperty('@nestjs/microservices');
    });

    it('should include nest-commander for cli-app projects', async () => {
      const outputDir = path.join(tmpDir, 'transport-cli-commander');
      await generate(makeConfig({ name: 'my-cli', projectType: 'cli-app', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('nest-commander');
    });

    it('should include @nestjs/schedule for scheduled-worker projects', async () => {
      const outputDir = path.join(tmpDir, 'transport-schedule');
      await generate(makeConfig({ name: 'my-worker', projectType: 'scheduled-worker', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/schedule');
    });

    it('should include @fastify/aws-lambda for aws-lambda projects', async () => {
      const outputDir = path.join(tmpDir, 'transport-lambda-fastify');
      await generate(makeConfig({ name: 'my-fn', projectType: 'aws-lambda', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@fastify/aws-lambda');
    });

    it('should include @nestjs/platform-fastify for http-api projects', async () => {
      const outputDir = path.join(tmpDir, 'transport-http-fastify');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/platform-fastify');
    });

    it('should have @nestjs/core in all generated projects', async () => {
      for (const type of ['http-api', 'aws-lambda', 'cli-app', 'scheduled-worker'] as const) {
        const outputDir = path.join(tmpDir, `transport-nestcore-${type}`);
        await generate(makeConfig({ name: `proj-${type}`, projectType: type, outputDir }), registry, TEMPLATES_DIR);
        const pkg = readJsonFile(path.join(outputDir, 'package.json'));
        expect(pkg.dependencies).toHaveProperty('@nestjs/core');
      }
    });

    it('should include rxjs in all generated projects', async () => {
      const outputDir = path.join(tmpDir, 'transport-rxjs');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('rxjs');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 43. FRONTEND FRAMEWORK CONFIG FILES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('43. Frontend Framework Config Files', () => {
    it('should generate next.config.* for nextjs frontend', async () => {
      const outputDir = path.join(tmpDir, 'fw-next-config');
      await generate(makeConfig({ name: 'fs', projectType: 'full-stack', frontendFramework: 'nextjs', outputDir }), registry, TEMPLATES_DIR);
      const webFiles = fs.readdirSync(path.join(outputDir, 'apps', 'web'), { recursive: true }) as string[];
      const hasNextConfig = webFiles.some((f) => String(f).includes('next.config'));
      expect(hasNextConfig).toBe(true);
    });

    it('should generate vite.config.* for vite-react frontend', async () => {
      const outputDir = path.join(tmpDir, 'fw-vite-config');
      await generate(makeConfig({ name: 'fs', projectType: 'full-stack', frontendFramework: 'vite-react', outputDir }), registry, TEMPLATES_DIR);
      const webFiles = fs.readdirSync(path.join(outputDir, 'apps', 'web'), { recursive: true }) as string[];
      const hasViteConfig = webFiles.some((f) => String(f).includes('vite.config'));
      expect(hasViteConfig).toBe(true);
    });

    it('should generate nuxt.config.* for nuxt frontend', async () => {
      const outputDir = path.join(tmpDir, 'fw-nuxt-config');
      await generate(makeConfig({ name: 'fs', projectType: 'full-stack', frontendFramework: 'nuxt', outputDir }), registry, TEMPLATES_DIR);
      const webFiles = fs.readdirSync(path.join(outputDir, 'apps', 'web'), { recursive: true }) as string[];
      const hasNuxtConfig = webFiles.some((f) => String(f).includes('nuxt.config'));
      expect(hasNuxtConfig).toBe(true);
    });

    it('should generate svelte.config.* for sveltekit frontend', async () => {
      const outputDir = path.join(tmpDir, 'fw-svelte-config');
      await generate(makeConfig({ name: 'fs', projectType: 'full-stack', frontendFramework: 'sveltekit', outputDir }), registry, TEMPLATES_DIR);
      const webFiles = fs.readdirSync(path.join(outputDir, 'apps', 'web'), { recursive: true }) as string[];
      const hasSvelteConfig = webFiles.some((f) => String(f).includes('svelte.config'));
      expect(hasSvelteConfig).toBe(true);
    });

    it('should generate apps/web/package.json for all full-stack projects', async () => {
      const outputDir = path.join(tmpDir, 'fw-webpkg');
      await generate(makeConfig({ name: 'fs', projectType: 'full-stack', frontendFramework: 'nextjs', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'apps', 'web', 'package.json'))).toBe(true);
    });

    it('should generate apps/web directory with content for all frontends', async () => {
      const frameworks: FrontendFramework[] = ['nextjs', 'vite-react', 'nuxt', 'sveltekit'];
      for (const fw of frameworks) {
        const outputDir = path.join(tmpDir, `fw-web-content-${fw}`);
        await generate(makeConfig({ name: 'fs', projectType: 'full-stack', frontendFramework: fw, outputDir }), registry, TEMPLATES_DIR);
        expect(dirExists(path.join(outputDir, 'apps', 'web'))).toBe(true);
        const webFiles = fs.readdirSync(path.join(outputDir, 'apps', 'web'));
        expect(webFiles.length).toBeGreaterThan(0);
      }
    });

    it('should generate pnpm-workspace.yaml for full-stack monorepo', async () => {
      const outputDir = path.join(tmpDir, 'fw-workspace-yaml');
      await generate(makeConfig({ name: 'fs', projectType: 'full-stack', frontendFramework: 'nextjs', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'pnpm-workspace.yaml'))).toBe(true);
    });

    it('should generate pnpm-workspace.yaml for monorepo project type', async () => {
      const outputDir = path.join(tmpDir, 'fw-monorepo-workspace');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'pnpm-workspace.yaml'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 44. PROMPT FLOW WITH RECIPE SELECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('44. Prompt Flow with Recipe Selections', () => {
    it('should return recipes array in config when recipes are selected', async () => {
      configurePromptMocks({
        name: 'recipe-test',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: ['swagger', 'pino', 'health-checks'],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.recipes).toEqual(['swagger', 'pino', 'health-checks']);
    });

    it('should return empty recipes array when none selected', async () => {
      configurePromptMocks({
        name: 'no-recipes',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.recipes).toEqual([]);
    });

    it('should return deployment targets in config', async () => {
      configurePromptMocks({
        name: 'deploy-test',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: ['dockerfile', 'kubernetes'],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.deploymentTargets).toContain('dockerfile');
      expect(config!.deploymentTargets).toContain('kubernetes');
    });

    it('should set outputDir to process.cwd() + project name', async () => {
      configurePromptMocks({
        name: 'path-test',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.outputDir).toBe(path.resolve(process.cwd(), 'path-test'));
    });

    it('should return correct projectType for cli-app in prompt flow', async () => {
      configurePromptMocks({
        name: 'cli-flow',
        projectType: 'cli-app',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.projectType).toBe('cli-app');
    });

    it('should return correct projectType for scheduled-worker in prompt flow', async () => {
      configurePromptMocks({
        name: 'worker-flow',
        projectType: 'scheduled-worker',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.projectType).toBe('scheduled-worker');
    });

    it('should return correct projectType for monorepo in prompt flow', async () => {
      configurePromptMocks({
        name: 'mono-flow',
        projectType: 'monorepo',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.projectType).toBe('monorepo');
    });

    it('should return correct projectType for aws-lambda in prompt flow', async () => {
      configurePromptMocks({
        name: 'lambda-flow',
        projectType: 'aws-lambda',
        cloudProvider: 'aws',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.projectType).toBe('aws-lambda');
    });

    it('should correctly pass 5 selected recipes through prompt flow', async () => {
      const selectedRecipes: RecipeId[] = ['swagger', 'pino', 'health-checks', 'cors', 'helmet'];
      configurePromptMocks({
        name: 'five-recipes',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: selectedRecipes,
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.recipes).toHaveLength(5);
      expect(config!.recipes).toEqual(selectedRecipes);
    });

    it('should correctly handle all deployment targets in prompt flow', async () => {
      configurePromptMocks({
        name: 'all-deploys',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: ['dockerfile', 'docker-compose', 'kubernetes', 'serverless-framework', 'terraform'],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.deploymentTargets).toHaveLength(5);
    });

    it('should return full config with all fields populated', async () => {
      configurePromptMocks({
        name: 'full-config',
        scope: '@myorg',
        projectType: 'http-api',
        cloudProvider: 'aws',
        recipes: ['swagger', 'pino'],
        deploymentTargets: ['dockerfile'],
        ciCdProvider: 'github-actions',
      });
      const config = await runAllPrompts(registry);
      expect(config!.name).toBe('full-config');
      expect(config!.scope).toBe('@myorg');
      expect(config!.projectType).toBe('http-api');
      expect(config!.cloudProvider).toBe('aws');
      expect(config!.ciCdProvider).toBe('github-actions');
    });

    it('should return null when user cancels at confirmation prompt', async () => {
      mockText.mockReset();
      mockSelect.mockReset();
      mockMultiselect.mockReset();
      mockConfirm.mockReset();
      mockText.mockResolvedValueOnce('cancel-test');
      mockText.mockResolvedValueOnce('');
      mockSelect.mockResolvedValueOnce('http-api');
      mockSelect.mockResolvedValueOnce('none');
      mockMultiselect.mockResolvedValueOnce([]);
      mockMultiselect.mockResolvedValueOnce([]);
      mockSelect.mockResolvedValueOnce('none');
      mockConfirm.mockResolvedValueOnce(false);
      const config = await runAllPrompts(registry);
      expect(config).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 45. QUEUE AND MESSAGING COMBOS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('45. Queue and Messaging Combos', () => {
    it('should generate with rabbitmq + aws-sqs together', async () => {
      const outputDir = path.join(tmpDir, 'queue-rmq-sqs');
      await generate(makeConfig({ name: 'my-api', recipes: ['rabbitmq', 'aws-sqs'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('RABBITMQ_URL');
      expect(env).toContain('SQS_QUEUE_URL');
    });

    it('should generate with rabbitmq + gcp-pubsub together', async () => {
      const outputDir = path.join(tmpDir, 'queue-rmq-pubsub');
      await generate(makeConfig({ name: 'my-api', recipes: ['rabbitmq', 'gcp-pubsub'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('RABBITMQ_URL');
      expect(env).toContain('PUBSUB_TOPIC');
    });

    it('should generate with bullmq + redis-cache together (shared redis)', async () => {
      const outputDir = path.join(tmpDir, 'queue-bullmq-redis');
      await generate(makeConfig({ name: 'my-api', recipes: ['bullmq', 'redis-cache'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('bullmq');
      expect(pkg.dependencies).toHaveProperty('@nestjs/cache-manager');
    });

    it('should generate with dead-letter-queue + rabbitmq', async () => {
      const outputDir = path.join(tmpDir, 'queue-dlq-rmq');
      await generate(makeConfig({ name: 'my-api', recipes: ['dead-letter-queue', 'rabbitmq'], outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('dead-letter-queue');
      expect(recipes).toHaveProperty('rabbitmq');
    });

    it('should generate with websockets + redis-cache', async () => {
      const outputDir = path.join(tmpDir, 'queue-ws-redis');
      await generate(makeConfig({ name: 'my-api', recipes: ['websockets', 'redis-cache'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/websockets');
      expect(pkg.dependencies).toHaveProperty('@nestjs/cache-manager');
    });

    it('should generate with azure-service-bus + bullmq', async () => {
      const outputDir = path.join(tmpDir, 'queue-azurebus-bullmq');
      await generate(makeConfig({ name: 'my-api', recipes: ['azure-service-bus', 'bullmq'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_SERVICE_BUS_CONNECTION_STRING');
    });

    it('should generate with sse + websockets together', async () => {
      const outputDir = path.join(tmpDir, 'queue-sse-ws');
      await generate(makeConfig({ name: 'my-api', recipes: ['sse', 'websockets'], outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('sse');
      expect(recipes).toHaveProperty('websockets');
    });

    it('should generate with rabbitmq + bullmq + dead-letter-queue + redis-cache', async () => {
      const outputDir = path.join(tmpDir, 'queue-full-messaging');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['rabbitmq', 'bullmq', 'dead-letter-queue', 'redis-cache'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('amqplib');
      expect(pkg.dependencies).toHaveProperty('bullmq');
    });

    it('should generate with aws-sqs + aws-sns + aws-eventbridge', async () => {
      const outputDir = path.join(tmpDir, 'queue-aws-all');
      await generate(
        makeConfig({ name: 'my-api', cloudProvider: 'aws', recipes: ['aws-sqs', 'aws-sns', 'aws-eventbridge'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SQS_QUEUE_URL');
      expect(env).toContain('SNS_TOPIC_ARN');
    });

    it('should generate with graphql-mercurius + websockets + sse', async () => {
      const outputDir = path.join(tmpDir, 'queue-graphql-realtime');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['graphql-mercurius', 'websockets', 'sse'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/graphql');
      expect(pkg.dependencies).toHaveProperty('@nestjs/websockets');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 46. DATABASE + DATA MANAGEMENT COMBOS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('46. Database + Data Management Combos', () => {
    it('should generate with typeorm-postgres + transactional-outbox', async () => {
      const outputDir = path.join(tmpDir, 'db-typeorm-outbox');
      await generate(makeConfig({ name: 'my-api', recipes: ['typeorm-postgres', 'transactional-outbox'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/typeorm');
    });

    it('should generate with prisma + soft-delete', async () => {
      const outputDir = path.join(tmpDir, 'db-prisma-softdelete');
      await generate(makeConfig({ name: 'my-api', recipes: ['prisma', 'soft-delete'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('DATABASE_URL');
    });

    it('should generate with drizzle-postgres + database-seeding', async () => {
      const outputDir = path.join(tmpDir, 'db-drizzle-seeding');
      await generate(makeConfig({ name: 'my-api', recipes: ['drizzle-postgres', 'database-seeding'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('drizzle-orm');
    });

    it('should generate with mongoose + data-masking', async () => {
      const outputDir = path.join(tmpDir, 'db-mongoose-masking');
      await generate(makeConfig({ name: 'my-api', recipes: ['mongoose', 'data-masking'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('mongoose');
    });

    it('should generate with typeorm-postgres + audit-trail + soft-delete', async () => {
      const outputDir = path.join(tmpDir, 'db-typeorm-audit');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['typeorm-postgres', 'audit-trail', 'soft-delete'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('audit-trail');
      expect(recipes).toHaveProperty('soft-delete');
    });

    it('should generate with kysely + database-factories', async () => {
      const outputDir = path.join(tmpDir, 'db-kysely-factories');
      await generate(makeConfig({ name: 'my-api', recipes: ['kysely', 'database-factories'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('kysely');
    });

    it('should generate with mikro-orm + database-seeding + database-factories', async () => {
      const outputDir = path.join(tmpDir, 'db-mikroorm-seeding');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['mikro-orm', 'database-seeding', 'database-factories'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@mikro-orm/core');
    });

    it('should generate with typeorm-mysql + redis-cache + pagination', async () => {
      const outputDir = path.join(tmpDir, 'db-mysql-redis-page');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['typeorm-mysql', 'redis-cache', 'pagination'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('typeorm');
    });

    it('should generate with prisma + multi-tenancy + audit-trail', async () => {
      const outputDir = path.join(tmpDir, 'db-prisma-multi-audit');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['prisma', 'multi-tenancy', 'audit-trail'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(recipes)).toHaveLength(3);
    });

    it('should generate with gcp-cloud-sql + drizzle-postgres', async () => {
      const outputDir = path.join(tmpDir, 'db-gcpsql-drizzle');
      await generate(
        makeConfig({ name: 'my-api', cloudProvider: 'gcp', recipes: ['gcp-cloud-sql', 'drizzle-postgres'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('CLOUD_SQL_CONNECTION_NAME');
    });

    it('should generate with azure-sql-database + typeorm-mysql', async () => {
      const outputDir = path.join(tmpDir, 'db-azuresql-typeorm');
      await generate(
        makeConfig({ name: 'my-api', cloudProvider: 'azure', recipes: ['azure-sql-database', 'typeorm-mysql'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('AZURE_SQL_HOST');
    });

    it('should generate with aws-dynamodb standalone (NoSQL)', async () => {
      const outputDir = path.join(tmpDir, 'db-dynamo-nosql');
      await generate(
        makeConfig({ name: 'my-api', cloudProvider: 'aws', recipes: ['aws-dynamodb'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('DYNAMODB_TABLE_NAME');
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 47. MONOREPO-SPECIFIC TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('47. Monorepo-Specific Tests', () => {
    it('should generate nx.json for monorepo projects', async () => {
      const outputDir = path.join(tmpDir, 'mono-nx');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'nx.json'))).toBe(true);
    });

    it('should generate nx.json for full-stack projects', async () => {
      const outputDir = path.join(tmpDir, 'mono-fs-nx');
      await generate(makeConfig({ name: 'my-fs', projectType: 'full-stack', frontendFramework: 'nextjs', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'nx.json'))).toBe(true);
    });

    it('should generate minimal nx.json for http-api (no workspace targetDefaults)', async () => {
      const outputDir = path.join(tmpDir, 'mono-no-nx');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'nx.json'))).toBe(true);
      const nxJson = readJsonFile(path.join(outputDir, 'nx.json'));
      // http-api uses the base minimal nx.json, not the full workspace one
      expect((nxJson as Record<string, unknown>).targetDefaults).toBeUndefined();
    });

    it('should generate apps/api/package.json or root package.json for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'mono-pkg');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      // At minimum, root package.json must exist
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });

    it('should generate correct nest-cli.json entryFile for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'mono-nestcli-entry');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      const nestCli = readJsonFile(path.join(outputDir, 'nest-cli.json'));
      // sourceRoot should point to apps/api/src for workspace types
      expect(nestCli.sourceRoot).toBe('apps/api/src');
    });

    it('should generate with typeorm-postgres recipe in apps/api/ for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'mono-typeorm');
      await generate(
        makeConfig({ name: 'my-mono', projectType: 'monorepo', recipes: ['typeorm-postgres'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(dirExists(path.join(outputDir, 'apps', 'api'))).toBe(true);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('typeorm-postgres');
    });

    it('should generate CI/CD for monorepo (github-actions)', async () => {
      const outputDir = path.join(tmpDir, 'mono-gha');
      await generate(
        makeConfig({ name: 'my-mono', projectType: 'monorepo', ciCdProvider: 'github-actions', outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, '.github', 'workflows', 'ci.yml'))).toBe(true);
    });

    it('should generate apps/api directory for full-stack project', async () => {
      const outputDir = path.join(tmpDir, 'mono-fs-api');
      await generate(makeConfig({ name: 'my-fs', projectType: 'full-stack', frontendFramework: 'vite-react', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'apps', 'api'))).toBe(true);
      expect(dirExists(path.join(outputDir, 'apps', 'web'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 48. ADDITIONAL EDGE CASES AND VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('48. Additional Edge Cases and Validation', () => {
    it('should validate successfully for all 7 project types without extra fields', () => {
      const types: ProjectType[] = ['http-api', 'aws-lambda', 'cli-app', 'scheduled-worker'];
      for (const type of types) {
        const result = validateConfig(makeConfig({ name: 'my-proj', projectType: type, outputDir: '/tmp/x' }));
        expect(result.success).toBe(true);
      }
    });

    it('should validate microservice as invalid when transportLayer is undefined', () => {
      const result = validateConfig(makeConfig({
        name: 'my-ms',
        projectType: 'microservice',
        transportLayer: undefined,
        outputDir: '/tmp/x',
      }));
      expect(result.success).toBe(false);
    });

    it('should validate full-stack as invalid when frontendFramework is undefined', () => {
      const result = validateConfig(makeConfig({
        name: 'my-fs',
        projectType: 'full-stack',
        frontendFramework: undefined,
        outputDir: '/tmp/x',
      }));
      expect(result.success).toBe(false);
    });

    it('should generate project with hyphenated name correctly', async () => {
      const outputDir = path.join(tmpDir, 'edge-hyphen-name');
      await generate(makeConfig({ name: 'my-awesome-api-v2', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.name).toBe('my-awesome-api-v2');
    });

    it('should generate project with all-numeric name "123" correctly', async () => {
      const result = validateConfig(makeConfig({ name: '123', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should not generate recipe files when recipe list is empty', async () => {
      const outputDir = path.join(tmpDir, 'edge-empty-recipes');
      await generate(makeConfig({ name: 'bare', recipes: [], outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      expect(Object.keys(manifest.recipes as object)).toHaveLength(0);
    });

    it('should generate with aws cloud provider but no extra recipes', async () => {
      const outputDir = path.join(tmpDir, 'edge-aws-no-recipes');
      await generate(makeConfig({ name: 'my-api', cloudProvider: 'aws', recipes: [], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });

    it('should generate with gcp cloud provider but no extra recipes', async () => {
      const outputDir = path.join(tmpDir, 'edge-gcp-no-recipes');
      await generate(makeConfig({ name: 'my-api', cloudProvider: 'gcp', recipes: [], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });

    it('should generate with azure cloud provider but no extra recipes', async () => {
      const outputDir = path.join(tmpDir, 'edge-azure-no-recipes');
      await generate(makeConfig({ name: 'my-api', cloudProvider: 'azure', recipes: [], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });

    it('should NOT generate main.tf without terraform in deploymentTargets', async () => {
      const outputDir = path.join(tmpDir, 'edge-no-tf');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['dockerfile'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'main.tf'))).toBe(false);
    });

    it('should NOT generate .github/workflows/ci.yml without a CI/CD provider', async () => {
      const outputDir = path.join(tmpDir, 'edge-no-ci');
      await generate(makeConfig({ name: 'my-api', ciCdProvider: undefined, outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, '.github', 'workflows', 'ci.yml'))).toBe(false);
    });

    it('should NOT generate serverless.yml without serverless-framework in deploymentTargets', async () => {
      const outputDir = path.join(tmpDir, 'edge-no-serverless');
      await generate(makeConfig({ name: 'my-api', deploymentTargets: ['dockerfile'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'serverless.yml'))).toBe(false);
    });

    it('should detect conflict between pino and winston in combo', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['swagger', 'pino', 'winston', 'health-checks'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should NOT detect conflict between unrelated recipes', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['swagger', 'throttler', 'cors', 'health-checks', 'pagination'], allRecipes);
      expect(conflicts).toHaveLength(0);
    });

    it('should generate with scope and all cloud recipes for AWS', async () => {
      const outputDir = path.join(tmpDir, 'edge-aws-scoped');
      await generate(
        makeConfig({
          name: 'my-api',
          scope: '@corp',
          cloudProvider: 'aws',
          recipes: ['aws-secrets-manager', 'aws-s3', 'aws-cloudwatch'],
          outputDir,
        }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.name).toBe('@corp/my-api');
    });

    it('should generate with recipes on all non-workspace project types', async () => {
      const types: Array<{ type: ProjectType; transport?: TransportLayer }> = [
        { type: 'http-api' },
        { type: 'aws-lambda' },
        { type: 'cli-app' },
        { type: 'scheduled-worker' },
        { type: 'microservice', transport: 'tcp' },
      ];
      for (const { type, transport } of types) {
        const outputDir = path.join(tmpDir, `edge-all-types-pino-${type}`);
        await generate(
          makeConfig({ name: `proj-${type}`, projectType: type, transportLayer: transport, recipes: ['pino', 'health-checks'], outputDir }),
          registry,
          TEMPLATES_DIR,
        );
        expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
        const pkg = readJsonFile(path.join(outputDir, 'package.json'));
        expect(pkg.dependencies).toHaveProperty('nestjs-pino');
      }
    });

    it('should generate content-digest with correct package dependencies', async () => {
      const outputDir = path.join(tmpDir, 'edge-content-digest');
      await generate(makeConfig({ name: 'my-api', recipes: ['content-digest'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });

    it('should generate dpop recipe without ESM errors in package.json', async () => {
      const outputDir = path.join(tmpDir, 'edge-dpop');
      await generate(makeConfig({ name: 'my-api', recipes: ['dpop'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });

    it('should handle microservice with custom transport correctly', async () => {
      const outputDir = path.join(tmpDir, 'edge-custom-transport');
      await generate(makeConfig({ name: 'my-ms', projectType: 'microservice', transportLayer: 'custom', outputDir }), registry, TEMPLATES_DIR);
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('createMicroservice');
    });

    it('should generate with seq2 logger standalone', async () => {
      const outputDir = path.join(tmpDir, 'edge-seq2');
      await generate(makeConfig({ name: 'my-api', recipes: ['seq2'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SEQ_SERVER_URL');
    });

    it('should generate json-merge-patch recipe independently', async () => {
      const outputDir = path.join(tmpDir, 'edge-json-merge-patch');
      await generate(makeConfig({ name: 'my-api', recipes: ['json-merge-patch'], outputDir }), registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('json-merge-patch');
    });

    it('should generate oauth2-introspection recipe with env vars', async () => {
      const outputDir = path.join(tmpDir, 'edge-oauth2-introspect');
      await generate(makeConfig({ name: 'my-api', recipes: ['oauth2-introspection'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('OAUTH2_INTROSPECTION_URL');
    });

    it('should generate api-keys recipe with env vars', async () => {
      const outputDir = path.join(tmpDir, 'edge-api-keys');
      await generate(makeConfig({ name: 'my-api', recipes: ['api-keys'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('API_KEY_HEADER');
    });

    it('should validate that all RECIPE_IDS are registered in the registry', () => {
      const allRecipes = registry.getAll();
      // Should be 112+ recipes
      expect(allRecipes.length).toBeGreaterThanOrEqual(100);
      // Every recipe should have required fields
      for (const recipe of allRecipes) {
        expect(recipe.id).toBeTruthy();
        expect(recipe.name).toBeTruthy();
        expect(recipe.category).toBeTruthy();
        expect(typeof recipe.dependencies).toBe('object');
        expect(Array.isArray(recipe.envVars)).toBe(true);
        expect(Array.isArray(recipe.conflicts)).toBe(true);
        expect(Array.isArray(recipe.requires)).toBe(true);
      }
    });
  });
});
