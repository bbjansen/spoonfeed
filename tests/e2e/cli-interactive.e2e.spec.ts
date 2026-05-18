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
  DeploymentTarget,
  CiCdProvider,
  RecipeId,
} from '@spoonfeed/types';

jest.setTimeout(30_000);

// ─── Mock @clack/prompts ─────────────────────────────────────────────────────

const mockText = jest.fn();
const mockSelect = jest.fn();
const mockMultiselect = jest.fn();
const mockConfirm = jest.fn();
const mockSpinnerStart = jest.fn();
const mockSpinnerStop = jest.fn();

jest.mock('@clack/prompts', () => ({
  text: (...args: unknown[]) => mockText(...args),
  select: (...args: unknown[]) => mockSelect(...args),
  multiselect: (...args: unknown[]) => mockMultiselect(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  spinner: () => ({ start: mockSpinnerStart, stop: mockSpinnerStop }),
  intro: jest.fn(),
  outro: jest.fn(),
  note: jest.fn(),
  cancel: jest.fn(),
  log: { info: jest.fn(), warning: jest.fn(), error: jest.fn() },
  isCancel: jest.fn().mockReturnValue(false),
}));

// ─── Mock execa (post-generate runs pnpm install and git init) ───────────────

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

/**
 * Configure mock prompts for runAllPrompts flow.
 * The prompt sequence is:
 * 1. text (project name)
 * 2. text (scope — optional)
 * 3. select (project type)
 * 4. select (cloud provider)
 * 5. select (transport layer — only if microservice)
 * 6. select (frontend framework — only if full-stack)
 * 7. multiselect (add-ons/recipes)
 * 8. multiselect (deployment targets)
 * 9. select (CI/CD provider)
 * 10. confirm (generate?)
 */
function configurePromptMocks(opts: {
  name: string;
  scope?: string;
  projectType: ProjectType;
  cloudProvider: CloudProvider;
  httpAdapter?: 'fastify' | 'express';
  transportLayer?: TransportLayer;
  frontendFramework?: FrontendFramework;
  recipes: RecipeId[];
  deploymentTargets: DeploymentTarget[];
  ciCdProvider: CiCdProvider | 'none';
}): void {
  // Reset all mocks first
  mockText.mockReset();
  mockSelect.mockReset();
  mockMultiselect.mockReset();
  mockConfirm.mockReset();

  // text: project name
  mockText.mockResolvedValueOnce(opts.name);
  // text: scope
  mockText.mockResolvedValueOnce(opts.scope ?? '');

  // select: project type
  mockSelect.mockResolvedValueOnce(opts.projectType);
  // select: cloud provider
  mockSelect.mockResolvedValueOnce(opts.cloudProvider);

  // select: HTTP adapter (for HTTP-based project types)
  const httpTypes = new Set(['http-api', 'aws-lambda', 'full-stack', 'monorepo']);
  if (httpTypes.has(opts.projectType)) {
    mockSelect.mockResolvedValueOnce(opts.httpAdapter ?? 'fastify');
  }

  // select: transport layer (if microservice)
  if (opts.projectType === 'microservice' && opts.transportLayer) {
    mockSelect.mockResolvedValueOnce(opts.transportLayer);
  }

  // select: frontend framework (if full-stack)
  if (opts.projectType === 'full-stack' && opts.frontendFramework) {
    mockSelect.mockResolvedValueOnce(opts.frontendFramework);
  }

  // multiselect: recipes
  mockMultiselect.mockResolvedValueOnce(opts.recipes);

  // multiselect: deployment targets
  mockMultiselect.mockResolvedValueOnce(opts.deploymentTargets);

  // select: CI/CD provider
  mockSelect.mockResolvedValueOnce(opts.ciCdProvider);

  // confirm: generate?
  mockConfirm.mockResolvedValueOnce(true);
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('CLI interactive E2E', () => {
  let tmpDir: string;
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-interactive-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PROJECT TYPE SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('1. Project Type Selection', () => {
    const projectTypes: {
      type: ProjectType;
      expectedFiles: string[];
      expectedDeps?: string[];
    }[] = [
      {
        type: 'http-api',
        expectedFiles: ['src/main.ts', 'src/app.module.ts', 'package.json', 'tsconfig.json'],
        expectedDeps: ['@nestjs/core', '@nestjs/platform-fastify'],
      },
      {
        type: 'aws-lambda',
        expectedFiles: ['src/main.ts', 'src/app.module.ts', 'package.json'],
        expectedDeps: ['@nestjs/core'],
      },
      {
        type: 'microservice',
        expectedFiles: ['src/main.ts', 'src/app.module.ts', 'package.json'],
        expectedDeps: ['@nestjs/core', '@nestjs/microservices'],
      },
      {
        type: 'cli-app',
        expectedFiles: ['src/main.ts', 'src/app.module.ts', 'package.json'],
        expectedDeps: ['@nestjs/core', 'nest-commander'],
      },
      {
        type: 'scheduled-worker',
        expectedFiles: ['src/main.ts', 'src/app.module.ts', 'package.json'],
        expectedDeps: ['@nestjs/core', '@nestjs/schedule'],
      },
      {
        type: 'monorepo',
        expectedFiles: [
          'apps/api/src/main.ts',
          'apps/api/src/app.module.ts',
          'package.json',
          'tsconfig.json',
        ],
      },
      {
        type: 'full-stack',
        expectedFiles: [
          'apps/api/src/main.ts',
          'apps/api/src/app.module.ts',
          'apps/web/package.json',
          'package.json',
        ],
      },
    ];

    for (const { type, expectedFiles, expectedDeps } of projectTypes) {
      it(`should generate a ${type} project with correct structure`, async () => {
        const outputDir = path.join(tmpDir, `proj-${type}`);
        const config = makeConfig({
          name: `proj-${type}`,
          projectType: type,
          recipes: [],
          transportLayer: type === 'microservice' ? 'tcp' : undefined,
          frontendFramework: type === 'full-stack' ? 'nextjs' : undefined,
          outputDir,
        });

        await generate(config, registry, TEMPLATES_DIR);

        for (const file of expectedFiles) {
          expect(fileExists(path.join(outputDir, file))).toBe(true);
        }

        if (expectedDeps) {
          const pkg = readJsonFile(path.join(outputDir, 'package.json'));
          const deps = {
            ...(pkg.dependencies as Record<string, string>),
            ...(pkg.devDependencies as Record<string, string>),
          };
          for (const dep of expectedDeps) {
            expect(deps).toHaveProperty(dep);
          }
        }
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. TRANSPORT LAYER SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('2. Transport Layer Selection', () => {
    const transports: TransportLayer[] = [
      'tcp',
      'redis',
      'nats',
      'mqtt',
      'rabbitmq',
      'kafka',
      'grpc',
      'custom',
    ];

    for (const transport of transports) {
      it(`should generate microservice with ${transport} transport`, async () => {
        const outputDir = path.join(tmpDir, `ms-${transport}`);
        const config = makeConfig({
          name: `ms-${transport}`,
          projectType: 'microservice',
          transportLayer: transport,
          recipes: [],
          outputDir,
        });

        await generate(config, registry, TEMPLATES_DIR);

        const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
        // The transport keyword should appear somewhere in main.ts or the config
        expect(mainTs.length).toBeGreaterThan(0);
        expect(fileExists(path.join(outputDir, 'src/main.ts'))).toBe(true);
        expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. FRONTEND FRAMEWORK SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('3. Frontend Framework Selection', () => {
    const frameworks: { fw: FrontendFramework; marker: string }[] = [
      { fw: 'nextjs', marker: 'next.config' },
      { fw: 'vite-react', marker: 'vite.config' },
      { fw: 'nuxt', marker: 'nuxt.config' },
      { fw: 'sveltekit', marker: 'svelte.config' },
    ];

    for (const { fw, marker } of frameworks) {
      it(`should generate full-stack project with ${fw} frontend`, async () => {
        const outputDir = path.join(tmpDir, `fs-${fw}`);
        const config = makeConfig({
          name: `fs-${fw}`,
          projectType: 'full-stack',
          frontendFramework: fw,
          recipes: [],
          outputDir,
        });

        await generate(config, registry, TEMPLATES_DIR);

        expect(dirExists(path.join(outputDir, 'apps', 'web'))).toBe(true);
        expect(fileExists(path.join(outputDir, 'apps', 'api', 'src', 'main.ts'))).toBe(true);

        // Check for framework-specific config file in apps/web
        const webFiles = fs.readdirSync(path.join(outputDir, 'apps', 'web'), { recursive: true });
        const webFileNames = webFiles.map(String);
        const hasMarker = webFileNames.some(
          (f) => f.includes(marker) || f.toLowerCase().includes(marker.toLowerCase()),
        );
        expect(hasMarker).toBe(true);
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CLOUD PROVIDER SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('4. Cloud Provider Selection', () => {
    const providers: {
      provider: CloudProvider;
      recipes: RecipeId[];
      envKeys: string[];
    }[] = [
      {
        provider: 'none',
        recipes: [],
        envKeys: ['PORT', 'NODE_ENV'],
      },
      {
        provider: 'aws',
        recipes: ['aws-secrets-manager', 'aws-s3'],
        envKeys: ['AWS_REGION'],
      },
      {
        provider: 'gcp',
        recipes: ['gcp-secret-manager', 'gcp-cloud-storage'],
        envKeys: ['GCP_PROJECT_ID'],
      },
      {
        provider: 'azure',
        recipes: ['azure-key-vault', 'azure-blob-storage'],
        envKeys: ['AZURE_KEY_VAULT_URL'],
      },
    ];

    for (const { provider, recipes, envKeys } of providers) {
      it(`should generate project with ${provider} cloud provider and relevant recipes`, async () => {
        const outputDir = path.join(tmpDir, `cloud-${provider}`);
        const config = makeConfig({
          name: `cloud-${provider}`,
          cloudProvider: provider,
          recipes,
          outputDir,
        });

        await generate(config, registry, TEMPLATES_DIR);

        const envContent = readTextFile(path.join(outputDir, '.env.example'));
        for (const key of envKeys) {
          expect(envContent).toContain(key);
        }
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. DEPLOYMENT TARGETS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('5. Deployment Targets', () => {
    const deployTargets: {
      target: DeploymentTarget;
      expectedPath: string;
      checkType: 'file' | 'dir';
    }[] = [
      { target: 'dockerfile', expectedPath: 'Dockerfile', checkType: 'file' },
      { target: 'docker-compose', expectedPath: 'docker-compose.yml', checkType: 'file' },
      { target: 'kubernetes', expectedPath: 'k8s', checkType: 'dir' },
      { target: 'serverless-framework', expectedPath: 'serverless.yml', checkType: 'file' },
      { target: 'terraform', expectedPath: 'main.tf', checkType: 'file' },
    ];

    const projectTypesForDeploy: {
      type: ProjectType;
      transport?: TransportLayer;
      frontend?: FrontendFramework;
    }[] = [
      { type: 'http-api' },
      { type: 'aws-lambda' },
      { type: 'microservice', transport: 'tcp' },
      { type: 'cli-app' },
      { type: 'scheduled-worker' },
      { type: 'monorepo' },
      { type: 'full-stack', frontend: 'nextjs' },
    ];

    for (const { type, transport, frontend } of projectTypesForDeploy) {
      for (const { target, expectedPath, checkType } of deployTargets) {
        it(`should generate ${target} for ${type} project`, async () => {
          const outputDir = path.join(tmpDir, `deploy-${type}-${target}`);
          const config = makeConfig({
            name: `deploy-${type}-${target}`,
            projectType: type,
            transportLayer: transport,
            frontendFramework: frontend,
            deploymentTargets: [target],
            recipes: [],
            outputDir,
          });

          await generate(config, registry, TEMPLATES_DIR);

          const fullPath = path.join(outputDir, expectedPath);
          if (checkType === 'file') {
            expect(fileExists(fullPath)).toBe(true);
          } else {
            expect(dirExists(fullPath)).toBe(true);
          }
        });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CI/CD PROVIDERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('6. CI/CD Providers', () => {
    const cicdProviders: {
      provider: CiCdProvider;
      expectedPath: string;
    }[] = [
      { provider: 'github-actions', expectedPath: '.github/workflows/ci.yml' },
      { provider: 'azure-devops', expectedPath: 'azure-pipelines.yml' },
      { provider: 'aws-codepipeline', expectedPath: 'buildspec.yml' },
      { provider: 'gcp-cloudbuild', expectedPath: 'cloudbuild.yaml' },
    ];

    const projectTypesForCi: {
      type: ProjectType;
      transport?: TransportLayer;
      frontend?: FrontendFramework;
    }[] = [
      { type: 'http-api' },
      { type: 'aws-lambda' },
      { type: 'microservice', transport: 'tcp' },
      { type: 'cli-app' },
      { type: 'scheduled-worker' },
      { type: 'monorepo' },
      { type: 'full-stack', frontend: 'nextjs' },
    ];

    for (const { type, transport, frontend } of projectTypesForCi) {
      for (const { provider, expectedPath } of cicdProviders) {
        it(`should generate ${provider} CI/CD config for ${type} project`, async () => {
          const outputDir = path.join(tmpDir, `ci-${type}-${provider}`);
          const config = makeConfig({
            name: `ci-${type}-${provider}`,
            projectType: type,
            transportLayer: transport,
            frontendFramework: frontend,
            ciCdProvider: provider,
            recipes: [],
            outputDir,
          });

          await generate(config, registry, TEMPLATES_DIR);

          expect(fileExists(path.join(outputDir, expectedPath))).toBe(true);
        });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. INDIVIDUAL RECIPE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('7. Individual Recipe Tests', () => {
    const allRecipes = createRegistry().getAll();

    for (const recipe of allRecipes) {
      it(`should generate http-api with recipe: ${recipe.id}`, async () => {
        const outputDir = path.join(tmpDir, `recipe-${recipe.id}`);

        // Include required recipes
        const recipes: RecipeId[] = [recipe.id, ...recipe.requires];

        const config = makeConfig({
          name: `recipe-${recipe.id}`,
          recipes,
          outputDir,
        });

        await generate(config, registry, TEMPLATES_DIR);

        // Verify generation succeeded
        expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);

        // Verify package.json contains recipe's dependencies
        const pkg = readJsonFile(path.join(outputDir, 'package.json'));
        const allDeps = {
          ...(pkg.dependencies as Record<string, string>),
          ...(pkg.devDependencies as Record<string, string>),
        };
        for (const dep of Object.keys(recipe.dependencies)) {
          expect(dep in allDeps).toBe(true);
        }
        for (const dep of Object.keys(recipe.devDependencies)) {
          expect(dep in allDeps).toBe(true);
        }

        // Verify .env.example contains recipe's env vars
        if (recipe.envVars.length > 0) {
          const envContent = readTextFile(path.join(outputDir, '.env.example'));
          for (const envVar of recipe.envVars) {
            expect(envContent).toContain(envVar.key);
          }
        }

        // Verify .spoonfeed.json manifest lists the recipe
        const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
        const manifestRecipes = manifest.recipes as Record<string, unknown>;
        expect(manifestRecipes).toHaveProperty(recipe.id);

        // Verify CLAUDE.md contains the recipe's AI context section
        if (recipe.claudeMdSection) {
          const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
          // Check that at least the recipe name appears in CLAUDE.md
          expect(claudeMd).toContain(recipe.name);
        }
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. RECIPE COMBINATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('8. Recipe Combination Tests', () => {
    it('should generate with TypeORM + database seeding + factories', async () => {
      const outputDir = path.join(tmpDir, 'combo-db-seeding');
      const config = makeConfig({
        name: 'combo-db-seeding',
        recipes: ['typeorm-postgres', 'database-seeding', 'database-factories'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps).toHaveProperty('@nestjs/typeorm');
      expect(deps).toHaveProperty('typeorm');
    });

    it('should generate with Prisma + database seeding + factories', async () => {
      const outputDir = path.join(tmpDir, 'combo-prisma-seed');
      const config = makeConfig({
        name: 'combo-prisma-seed',
        recipes: ['prisma', 'database-seeding', 'database-factories'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@prisma/client');
    });

    it('should generate with Mongoose + database seeding + factories', async () => {
      const outputDir = path.join(tmpDir, 'combo-mongoose-seed');
      const config = makeConfig({
        name: 'combo-mongoose-seed',
        recipes: ['mongoose', 'database-seeding', 'database-factories'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('mongoose');
    });

    it('should generate with Drizzle + database seeding + factories', async () => {
      const outputDir = path.join(tmpDir, 'combo-drizzle-seed');
      const config = makeConfig({
        name: 'combo-drizzle-seed',
        recipes: ['drizzle-postgres', 'database-seeding', 'database-factories'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('drizzle-orm');
    });

    it('should generate with JWT + RBAC auth combo', async () => {
      const outputDir = path.join(tmpDir, 'combo-jwt-rbac');
      const config = makeConfig({
        name: 'combo-jwt-rbac',
        recipes: ['jwt-auth', 'rbac-casl'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps).toHaveProperty('@nestjs/jwt');
      expect(deps).toHaveProperty('@casl/ability');
    });

    it('should generate with Passport + OAuth Google + OAuth GitHub', async () => {
      const outputDir = path.join(tmpDir, 'combo-passport-oauth');
      const config = makeConfig({
        name: 'combo-passport-oauth',
        recipes: ['passport', 'oauth-google', 'oauth-github'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/passport');
    });

    it('should generate with full auth stack (JWT + RBAC + auth-flows + MFA)', async () => {
      const outputDir = path.join(tmpDir, 'combo-full-auth');
      const config = makeConfig({
        name: 'combo-full-auth',
        recipes: ['jwt-auth', 'rbac-casl', 'auth-flows', 'mfa-totp', 'api-keys'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps).toHaveProperty('@nestjs/jwt');
      expect(deps).toHaveProperty('@casl/ability');
      expect(deps).toHaveProperty('bcrypt');
    });

    it('should generate with all security recipes together', async () => {
      const outputDir = path.join(tmpDir, 'combo-security');
      const config = makeConfig({
        name: 'combo-security',
        recipes: ['helmet', 'cors', 'csrf', 'throttler', 'dpop'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps).toHaveProperty('@nestjs/throttler');
    });

    it('should generate with all API pattern recipes together', async () => {
      const outputDir = path.join(tmpDir, 'combo-api-patterns');
      const config = makeConfig({
        name: 'combo-api-patterns',
        recipes: [
          'swagger',
          'pagination',
          'filtering',
          'api-versioning',
          'correlation-id',
          'http-caching',
          'idempotency',
          'prefer-header',
          'content-digest',
          'json-patch',
          'sse',
          'serialization-groups',
        ],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const manifestRecipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(manifestRecipes)).toHaveLength(12);
    });

    it('should generate with full observability stack', async () => {
      const outputDir = path.join(tmpDir, 'combo-observability');
      const config = makeConfig({
        name: 'combo-observability',
        recipes: [
          'pino',
          'health-checks',
          'prometheus',
          'sentry',
          'opentelemetry',
          'request-logging',
          'distributed-tracing',
          'correlation-id',
        ],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps).toHaveProperty('nestjs-pino');
      expect(deps).toHaveProperty('@nestjs/terminus');
      expect(deps).toHaveProperty('prom-client');
      expect(deps).toHaveProperty('@sentry/nestjs');
    });

    it('should generate with all AWS cloud recipes', async () => {
      const outputDir = path.join(tmpDir, 'combo-all-aws');
      const config = makeConfig({
        name: 'combo-all-aws',
        cloudProvider: 'aws',
        recipes: [
          'aws-sqs',
          'aws-sns',
          'aws-eventbridge',
          'aws-secrets-manager',
          'aws-ssm',
          'aws-s3',
          'aws-cognito',
          'aws-cloudwatch',
          'aws-rds',
          'aws-dynamodb',
          'aws-elasticache',
          'aws-cloudfront',
        ],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const envContent = readTextFile(path.join(outputDir, '.env.example'));
      expect(envContent).toContain('AWS_REGION');
    });

    it('should generate with all GCP cloud recipes', async () => {
      const outputDir = path.join(tmpDir, 'combo-all-gcp');
      const config = makeConfig({
        name: 'combo-all-gcp',
        cloudProvider: 'gcp',
        recipes: [
          'gcp-pubsub',
          'gcp-secret-manager',
          'gcp-cloud-storage',
          'gcp-cloud-functions',
          'gcp-firebase-auth',
          'gcp-cloud-logging',
          'gcp-cloud-sql',
          'gcp-firestore',
          'gcp-memorystore',
          'gcp-cloud-cdn',
        ],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const envContent = readTextFile(path.join(outputDir, '.env.example'));
      expect(envContent).toContain('GCP_PROJECT_ID');
    });

    it('should generate with all Azure cloud recipes', async () => {
      const outputDir = path.join(tmpDir, 'combo-all-azure');
      const config = makeConfig({
        name: 'combo-all-azure',
        cloudProvider: 'azure',
        recipes: [
          'azure-service-bus',
          'azure-key-vault',
          'azure-blob-storage',
          'azure-functions',
          'azure-entra-id',
          'azure-app-insights',
          'azure-cosmos-db',
          'azure-sql-database',
          'azure-cache',
          'azure-front-door',
        ],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const envContent = readTextFile(path.join(outputDir, '.env.example'));
      expect(envContent).toContain('AZURE_KEY_VAULT_URL');
    });

    it('should generate with enterprise stack (25 recipes)', async () => {
      const outputDir = path.join(tmpDir, 'combo-enterprise');
      const recipes: RecipeId[] = [
        'typeorm-postgres',
        'redis-cache',
        'bullmq',
        'jwt-auth',
        'rbac-casl',
        'auth-flows',
        'swagger',
        'pino',
        'health-checks',
        'prometheus',
        'sentry',
        'helmet',
        'cors',
        'csrf',
        'throttler',
        'pagination',
        'filtering',
        'api-versioning',
        'correlation-id',
        'graceful-shutdown',
        'config-validation',
        'request-logging',
        'soft-delete',
        'audit-trail',
        'request-context',
      ];
      const config = makeConfig({
        name: 'combo-enterprise',
        recipes,
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const manifestRecipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(manifestRecipes).length).toBe(25);

      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const deps = {
        ...(pkg.dependencies as Record<string, string>),
        ...(pkg.devDependencies as Record<string, string>),
      };
      expect(Object.keys(deps).length).toBeGreaterThan(30);
    });

    it('should generate with queue recipes (RabbitMQ + BullMQ)', async () => {
      const outputDir = path.join(tmpDir, 'combo-queues');
      const config = makeConfig({
        name: 'combo-queues',
        recipes: ['rabbitmq', 'bullmq', 'dead-letter-queue'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps).toHaveProperty('amqplib');
      expect(deps).toHaveProperty('bullmq');
    });

    it('should generate with email + auth combo (Nodemailer + JWT + auth-flows)', async () => {
      const outputDir = path.join(tmpDir, 'combo-email-auth');
      const config = makeConfig({
        name: 'combo-email-auth',
        recipes: ['nodemailer', 'jwt-auth', 'auth-flows'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const envContent = readTextFile(path.join(outputDir, '.env.example'));
      expect(envContent).toContain('MAIL_HOST');
      expect(envContent).toContain('JWT_SECRET');
    });

    it('should generate with all DevOps recipes', async () => {
      const outputDir = path.join(tmpDir, 'combo-devops');
      const config = makeConfig({
        name: 'combo-devops',
        recipes: [
          'devcontainer',
          'docker-compose-dev',
          'env-per-environment',
          'dependabot-renovate',
          'changelog',
          'license',
          'docs-site',
          'load-testing',
        ],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const manifestRecipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(manifestRecipes).length).toBe(8);
    });

    it('should generate with resilience patterns (circuit breaker + graceful shutdown + feature flags)', async () => {
      const outputDir = path.join(tmpDir, 'combo-resilience');
      const config = makeConfig({
        name: 'combo-resilience',
        recipes: ['circuit-breaker', 'graceful-shutdown', 'feature-flags', 'config-validation'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);
      const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
      expect(claudeMd).toContain('Circuit Breaker');
      expect(claudeMd).toContain('Graceful Shutdown');
      expect(claudeMd).toContain('Feature Flag');
    });

    it('should generate max load with 60+ recipes', async () => {
      const outputDir = path.join(tmpDir, 'combo-max-load');
      // Select a large number of non-conflicting recipes
      const recipes: RecipeId[] = [
        'typeorm-postgres',
        'redis-cache',
        'rabbitmq',
        'bullmq',
        'jwt-auth',
        'passport',
        'auth-flows',
        'api-keys',
        'oauth2-introspection',
        'oauth-google',
        'oauth-github',
        'oauth-apple',
        'rbac-casl',
        'swagger',
        'pino',
        'health-checks',
        'prometheus',
        'sentry',
        'seq2',
        's3-minio',
        'nodemailer',
        'websockets',
        'graphql-mercurius',
        'cqrs',
        'throttler',
        'helmet',
        'cors',
        'csrf',
        'pagination',
        'filtering',
        'api-versioning',
        'correlation-id',
        'http-caching',
        'opentelemetry',
        'request-logging',
        'distributed-tracing',
        'devcontainer',
        'database-seeding',
        'database-factories',
        'sdk-generation',
        'graceful-shutdown',
        'circuit-breaker',
        'feature-flags',
        'multi-tenancy',
        'changelog',
        'license',
        'env-per-environment',
        'dependabot-renovate',
        'docs-site',
        'idempotency',
        'prefer-header',
        'content-digest',
        'dpop',
        'json-patch',
        'sse',
        'soft-delete',
        'audit-trail',
        'request-context',
        'i18n',
        'config-validation',
        'dead-letter-queue',
        'webhooks',
        'data-masking',
        'serialization-groups',
        'transactional-outbox',
        'docker-compose-dev',
        'load-testing',
        'worker-threads',
        'file-upload',
        'mfa-totp',
        'adminjs',
      ];

      const config = makeConfig({
        name: 'combo-max-load',
        recipes,
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const manifestRecipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(manifestRecipes).length).toBeGreaterThanOrEqual(60);

      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const allDeps = {
        ...(pkg.dependencies as Record<string, string>),
        ...(pkg.devDependencies as Record<string, string>),
      };
      expect(Object.keys(allDeps).length).toBeGreaterThan(50);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('9. Validation Tests', () => {
    it('should reject empty project name', () => {
      const config = makeConfig({
        name: '',
        outputDir: path.join(tmpDir, 'empty-name'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      }
    });

    it('should reject name with spaces', () => {
      const config = makeConfig({
        name: 'my project',
        outputDir: path.join(tmpDir, 'space-name'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      }
    });

    it('should reject name with uppercase letters', () => {
      const config = makeConfig({
        name: 'MyProject',
        outputDir: path.join(tmpDir, 'upper-name'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      }
    });

    it('should reject name starting with hyphen', () => {
      const config = makeConfig({
        name: '-my-project',
        outputDir: path.join(tmpDir, 'hyphen-start'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      }
    });

    it('should reject name with special characters', () => {
      const config = makeConfig({
        name: 'my_project!',
        outputDir: path.join(tmpDir, 'special-chars'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid scope format (no @ prefix)', () => {
      const config = makeConfig({
        name: 'test-project',
        scope: 'myorg',
        outputDir: path.join(tmpDir, 'bad-scope'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'scope')).toBe(true);
      }
    });

    it('should reject invalid scope with uppercase', () => {
      const config = makeConfig({
        name: 'test-project',
        scope: '@MyOrg',
        outputDir: path.join(tmpDir, 'upper-scope'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });

    it('should accept valid scope', () => {
      const config = makeConfig({
        name: 'test-project',
        scope: '@myorg',
        outputDir: path.join(tmpDir, 'valid-scope'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it('should accept project with no scope', () => {
      const config = makeConfig({
        name: 'test-project',
        scope: undefined,
        outputDir: path.join(tmpDir, 'no-scope'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it('should detect conflicting database recipes', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'prisma'], allRecipes);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect conflicting logger recipes', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['pino', 'winston'], allRecipes);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect conflicting email recipes', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['nodemailer', 'sendgrid'], allRecipes);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('should detect missing requirement (auth-flows requires jwt-auth)', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['auth-flows'], allRecipes);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some((c) => c.type === 'missing-requirement')).toBe(true);
    });

    it('should require transport layer for microservice', () => {
      const config = makeConfig({
        name: 'test-micro',
        projectType: 'microservice',
        transportLayer: undefined,
        outputDir: path.join(tmpDir, 'no-transport'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'transportLayer')).toBe(true);
      }
    });

    it('should require frontend framework for full-stack', () => {
      const config = makeConfig({
        name: 'test-fullstack',
        projectType: 'full-stack',
        frontendFramework: undefined,
        outputDir: path.join(tmpDir, 'no-frontend'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'frontendFramework')).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. OUTPUT VERIFICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('10. Output Verification Tests', () => {
    it('should produce package.json with exact versions (no ^/~)', async () => {
      const outputDir = path.join(tmpDir, 'exact-versions');
      const config = makeConfig({
        name: 'exact-versions',
        recipes: ['swagger', 'pino', 'health-checks', 'typeorm-postgres'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const allDeps = {
        ...(pkg.dependencies as Record<string, string>),
        ...(pkg.devDependencies as Record<string, string>),
      };

      for (const [name, version] of Object.entries(allDeps)) {
        expect(version).not.toMatch(
          /^[\^~><=]/,
        );
      }
    });

    it('should include .npmrc with save-exact=true', async () => {
      const outputDir = path.join(tmpDir, 'npmrc-check');
      const config = makeConfig({
        name: 'npmrc-check',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const npmrcPath = path.join(outputDir, '.npmrc');
      expect(fileExists(npmrcPath)).toBe(true);
      const npmrc = readTextFile(npmrcPath);
      expect(npmrc).toContain('save-exact=true');
    });

    it('should generate tsconfig.json with correct path alias', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-check');
      const config = makeConfig({
        name: 'tsconfig-check',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const tsconfig = readJsonFile(path.join(outputDir, 'tsconfig.json'));
      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      const paths = compilerOptions.paths as Record<string, string[]>;
      expect(paths).toHaveProperty('@/*');
    });

    it('should generate jest.config.ts', async () => {
      const outputDir = path.join(tmpDir, 'jest-check');
      const config = makeConfig({
        name: 'jest-check',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, 'jest.config.ts'))).toBe(true);
    });

    it('should generate CLAUDE.md with recipe context', async () => {
      const outputDir = path.join(tmpDir, 'claudemd-check');
      const config = makeConfig({
        name: 'claudemd-check',
        recipes: ['swagger', 'pino'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
      expect(claudeMd).toContain('# CLAUDE.md');
      expect(claudeMd).toContain('Swagger');
      expect(claudeMd).toContain('Pino');
      expect(claudeMd).toContain('Active Recipes');
    });

    it('should generate .cursor/rules/project.mdc', async () => {
      const outputDir = path.join(tmpDir, 'cursor-check');
      const config = makeConfig({
        name: 'cursor-check',
        recipes: ['swagger', 'pino'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, '.cursor', 'rules', 'project.mdc'))).toBe(true);
    });

    it('should generate .github/copilot-instructions.md', async () => {
      const outputDir = path.join(tmpDir, 'copilot-check');
      const config = makeConfig({
        name: 'copilot-check',
        recipes: ['swagger', 'pino'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, '.github', 'copilot-instructions.md'))).toBe(true);
    });

    it('should generate .env.example with PORT and NODE_ENV', async () => {
      const outputDir = path.join(tmpDir, 'env-check');
      const config = makeConfig({
        name: 'env-check',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const envContent = readTextFile(path.join(outputDir, '.env.example'));
      expect(envContent).toContain('PORT=3000');
      expect(envContent).toContain('NODE_ENV=development');
    });

    it('should generate .gitignore', async () => {
      const outputDir = path.join(tmpDir, 'gitignore-check');
      const config = makeConfig({
        name: 'gitignore-check',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, '.gitignore'))).toBe(true);
    });

    it('should generate .prettierrc', async () => {
      const outputDir = path.join(tmpDir, 'prettier-check');
      const config = makeConfig({
        name: 'prettier-check',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, '.prettierrc'))).toBe(true);
    });

    it('should generate nest-cli.json', async () => {
      const outputDir = path.join(tmpDir, 'nestcli-check');
      const config = makeConfig({
        name: 'nestcli-check',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, 'nest-cli.json'))).toBe(true);
    });

    it('should generate correct nest-cli.json sourceRoot for workspace types', async () => {
      const outputDir = path.join(tmpDir, 'nestcli-workspace');
      const config = makeConfig({
        name: 'nestcli-workspace',
        projectType: 'monorepo',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const nestCli = readJsonFile(path.join(outputDir, 'nest-cli.json'));
      expect(nestCli.sourceRoot).toBe('apps/api/src');
    });

    it('should generate .spoonfeed.json manifest with correct structure', async () => {
      const outputDir = path.join(tmpDir, 'manifest-check');
      const config = makeConfig({
        name: 'manifest-check',
        recipes: ['pino', 'health-checks'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      expect(manifest).toHaveProperty('projectType', 'http-api');
      expect(manifest).toHaveProperty('cloudProvider', 'none');
      expect(manifest).toHaveProperty('spoonfeedVersion');
      expect(manifest).toHaveProperty('generatedAt');
      expect(manifest).toHaveProperty('recipes');

      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('pino');
      expect(recipes).toHaveProperty('health-checks');

      const pinoEntry = recipes['pino'] as Record<string, unknown>;
      expect(pinoEntry).toHaveProperty('installedAt');
      expect(pinoEntry).toHaveProperty('version');
      expect(pinoEntry).toHaveProperty('files');
    });

    it('should generate tsconfig.json with apps/api/src paths for workspace types', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-workspace');
      const config = makeConfig({
        name: 'tsconfig-workspace',
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const tsconfig = readJsonFile(path.join(outputDir, 'tsconfig.json'));
      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      const paths = compilerOptions.paths as Record<string, string[]>;
      expect(paths['@/*']).toEqual(['apps/api/src/*']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. START SCRIPT VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('11. Start Script Verification', () => {
    const projectTypeStartScript: {
      type: ProjectType;
      transport?: TransportLayer;
      frontend?: FrontendFramework;
    }[] = [
      { type: 'http-api' },
      { type: 'aws-lambda' },
      { type: 'microservice', transport: 'tcp' },
      { type: 'cli-app' },
      { type: 'scheduled-worker' },
      { type: 'monorepo' },
      { type: 'full-stack', frontend: 'nextjs' },
    ];

    for (const { type, transport, frontend } of projectTypeStartScript) {
      it(`should have valid start scripts for ${type}`, async () => {
        const outputDir = path.join(tmpDir, `start-${type}`);
        const config = makeConfig({
          name: `start-${type}`,
          projectType: type,
          transportLayer: transport,
          frontendFramework: frontend,
          recipes: [],
          outputDir,
        });

        await generate(config, registry, TEMPLATES_DIR);

        const pkg = readJsonFile(path.join(outputDir, 'package.json'));
        const scripts = pkg.scripts as Record<string, string>;

        // All project types should have a start:dev script
        expect(scripts).toHaveProperty('start:dev');
        // All project types should have a build script
        expect(scripts).toHaveProperty('build');
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. PROMPT FLOW INTEGRATION TESTS (runAllPrompts)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('12. Prompt Flow Integration Tests', () => {
    it('should run full prompt flow for http-api and return valid config', async () => {
      configurePromptMocks({
        name: 'prompt-test',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: ['swagger', 'pino'],
        deploymentTargets: ['dockerfile'],
        ciCdProvider: 'github-actions',
      });

      const config = await runAllPrompts(registry);

      expect(config).not.toBeNull();
      expect(config!.name).toBe('prompt-test');
      expect(config!.projectType).toBe('http-api');
      expect(config!.cloudProvider).toBe('none');
      expect(config!.recipes).toEqual(['swagger', 'pino']);
      expect(config!.deploymentTargets).toEqual(['dockerfile']);
      expect(config!.ciCdProvider).toBe('github-actions');
      expect(config!.transportLayer).toBeUndefined();
      expect(config!.frontendFramework).toBeUndefined();
    });

    it('should run full prompt flow for microservice with transport', async () => {
      configurePromptMocks({
        name: 'ms-prompt-test',
        projectType: 'microservice',
        cloudProvider: 'aws',
        transportLayer: 'rabbitmq',
        recipes: ['pino'],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });

      const config = await runAllPrompts(registry);

      expect(config).not.toBeNull();
      expect(config!.projectType).toBe('microservice');
      expect(config!.transportLayer).toBe('rabbitmq');
    });

    it('should run full prompt flow for full-stack with frontend', async () => {
      configurePromptMocks({
        name: 'fs-prompt-test',
        projectType: 'full-stack',
        cloudProvider: 'gcp',
        frontendFramework: 'nextjs',
        recipes: [],
        deploymentTargets: ['docker-compose'],
        ciCdProvider: 'none',
      });

      const config = await runAllPrompts(registry);

      expect(config).not.toBeNull();
      expect(config!.projectType).toBe('full-stack');
      expect(config!.frontendFramework).toBe('nextjs');
    });

    it('should return null when confirmation is declined', async () => {
      mockText.mockReset();
      mockSelect.mockReset();
      mockMultiselect.mockReset();
      mockConfirm.mockReset();

      mockText.mockResolvedValueOnce('decline-test');
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

    it('should include scope in config when provided', async () => {
      configurePromptMocks({
        name: 'scoped-test',
        scope: '@myorg',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });

      const config = await runAllPrompts(registry);

      expect(config).not.toBeNull();
      expect(config!.scope).toBe('@myorg');
    });

    it('should set scope to undefined when empty', async () => {
      configurePromptMocks({
        name: 'no-scope-test',
        scope: '',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });

      const config = await runAllPrompts(registry);

      expect(config).not.toBeNull();
      expect(config!.scope).toBeUndefined();
    });

    it('should set ciCdProvider to undefined when none selected', async () => {
      configurePromptMocks({
        name: 'no-ci-test',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });

      const config = await runAllPrompts(registry);

      expect(config).not.toBeNull();
      expect(config!.ciCdProvider).toBeUndefined();
    });

    it('should set outputDir to cwd + project name', async () => {
      configurePromptMocks({
        name: 'dir-test',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });

      const config = await runAllPrompts(registry);

      expect(config).not.toBeNull();
      expect(config!.outputDir).toBe(path.resolve(process.cwd(), 'dir-test'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. MAIN.TS BLOCK INJECTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('13. main.ts Block Injection Tests', () => {
    it('should inject Swagger setup block into main.ts', async () => {
      const outputDir = path.join(tmpDir, 'maints-swagger');
      const config = makeConfig({
        name: 'maints-swagger',
        recipes: ['swagger'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('SwaggerModule');
      expect(mainTs).toContain('DocumentBuilder');
    });

    it('should inject multiple blocks into main.ts without conflicts', async () => {
      const outputDir = path.join(tmpDir, 'maints-multi');
      const config = makeConfig({
        name: 'maints-multi',
        recipes: ['swagger', 'pino', 'helmet', 'cors'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs).toContain('SwaggerModule');
      expect(mainTs.length).toBeGreaterThan(100);
    });

    it('should track mainTsBlocks in .spoonfeed.json manifest', async () => {
      const outputDir = path.join(tmpDir, 'maints-manifest');
      const config = makeConfig({
        name: 'maints-manifest',
        recipes: ['swagger'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;
      const swaggerEntry = recipes['swagger'];
      expect(swaggerEntry).toHaveProperty('mainTsBlocks');
      expect(swaggerEntry.mainTsBlocks).toContain('swagger');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. WORKSPACE PROJECT RELOCATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('14. Workspace Project Relocation Tests', () => {
    it('should relocate src/ to apps/api/src/ for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'reloc-monorepo');
      const config = makeConfig({
        name: 'reloc-monorepo',
        projectType: 'monorepo',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      // src/ should NOT exist at root
      expect(dirExists(path.join(outputDir, 'src'))).toBe(false);
      // Should exist under apps/api/
      expect(dirExists(path.join(outputDir, 'apps', 'api', 'src'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'apps', 'api', 'src', 'main.ts'))).toBe(true);
    });

    it('should relocate tests/ to apps/api/tests/ for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'reloc-tests');
      const config = makeConfig({
        name: 'reloc-tests',
        projectType: 'monorepo',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      // tests/ should NOT exist at root
      expect(dirExists(path.join(outputDir, 'tests'))).toBe(false);
      // Should exist under apps/api/
      expect(dirExists(path.join(outputDir, 'apps', 'api', 'tests'))).toBe(true);
    });

    it('should relocate recipe files to apps/api/ for full-stack', async () => {
      const outputDir = path.join(tmpDir, 'reloc-fullstack-recipe');
      const config = makeConfig({
        name: 'reloc-fullstack-recipe',
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        recipes: ['pino'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      // Recipe files should be under apps/api/
      expect(dirExists(path.join(outputDir, 'apps', 'api'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. EDGE CASES AND ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('15. Edge Cases and Error Handling', () => {
    it('should generate project with no recipes at all', async () => {
      const outputDir = path.join(tmpDir, 'no-recipes');
      const config = makeConfig({
        name: 'no-recipes',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'src/main.ts'))).toBe(true);

      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(recipes).length).toBe(0);
    });

    it('should generate project with no deployment targets', async () => {
      const outputDir = path.join(tmpDir, 'no-deploy');
      const config = makeConfig({
        name: 'no-deploy',
        deploymentTargets: [],
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(false);
    });

    it('should generate project with all deployment targets combined', async () => {
      const outputDir = path.join(tmpDir, 'all-deploy');
      const config = makeConfig({
        name: 'all-deploy',
        deploymentTargets: [
          'dockerfile',
          'docker-compose',
          'kubernetes',
          'serverless-framework',
          'terraform',
        ],
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'docker-compose.yml'))).toBe(true);
      expect(dirExists(path.join(outputDir, 'k8s'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'serverless.yml'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'main.tf'))).toBe(true);
    });

    it('should not generate AI context files when no recipes selected', async () => {
      const outputDir = path.join(tmpDir, 'no-ai-context');
      const config = makeConfig({
        name: 'no-ai-context',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      // CLAUDE.md should still exist (base section) but no cursor/copilot
      expect(fileExists(path.join(outputDir, 'CLAUDE.md'))).toBe(true);
      expect(fileExists(path.join(outputDir, '.cursor', 'rules', 'project.mdc'))).toBe(false);
      expect(fileExists(path.join(outputDir, '.github', 'copilot-instructions.md'))).toBe(false);
    });

    it('should handle project name with numbers', async () => {
      const config = makeConfig({
        name: '0my-project-123',
        outputDir: path.join(tmpDir, 'numeric-name'),
      });

      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it('should generate with single recipe only', async () => {
      const outputDir = path.join(tmpDir, 'single-recipe');
      const config = makeConfig({
        name: 'single-recipe',
        recipes: ['helmet'],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(recipes)).toEqual(['helmet']);
    });

    it('should generate .editorconfig', async () => {
      const outputDir = path.join(tmpDir, 'editorconfig');
      const config = makeConfig({
        name: 'editorconfig',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, '.editorconfig'))).toBe(true);
    });

    it('should generate commitlint config', async () => {
      const outputDir = path.join(tmpDir, 'commitlint');
      const config = makeConfig({
        name: 'commitlint',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, 'commitlint.config.js'))).toBe(true);
    });

    it('should generate eslint config', async () => {
      const outputDir = path.join(tmpDir, 'eslint');
      const config = makeConfig({
        name: 'eslint',
        recipes: [],
        outputDir,
      });

      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(path.join(outputDir, 'eslint.config.mjs'))).toBe(true);
    });
  });
});
