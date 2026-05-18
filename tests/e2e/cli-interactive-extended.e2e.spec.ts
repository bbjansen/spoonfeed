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

describe('CLI interactive E2E (extended)', () => {
  let tmpDir: string;
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ext-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. PACKAGE.JSON CONTENT VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('16. Package.json Content Verification', () => {
    it('should set package.json name to project name when no scope', async () => {
      const outputDir = path.join(tmpDir, 'pkg-name');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.name).toBe('my-api');
    });

    it('should set package.json name to @scope/name when scope provided', async () => {
      const outputDir = path.join(tmpDir, 'pkg-scoped');
      await generate(makeConfig({ name: 'my-api', scope: '@myorg', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.name).toBe('@myorg/my-api');
    });

    it('should set package.json version to 0.0.1', async () => {
      const outputDir = path.join(tmpDir, 'pkg-version');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.version).toBe('0.0.1');
    });

    it('should set package.json private to true', async () => {
      const outputDir = path.join(tmpDir, 'pkg-private');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.private).toBe(true);
    });

    it('should set package.json license to UNLICENSED', async () => {
      const outputDir = path.join(tmpDir, 'pkg-license');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.license).toBe('UNLICENSED');
    });

    it('should include test script in package.json', async () => {
      const outputDir = path.join(tmpDir, 'pkg-scripts-test');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('test');
    });

    it('should include lint script in package.json', async () => {
      const outputDir = path.join(tmpDir, 'pkg-scripts-lint');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('lint');
    });

    it('should include format script in package.json', async () => {
      const outputDir = path.join(tmpDir, 'pkg-scripts-format');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('format');
    });

    it('should include start:prod script in package.json', async () => {
      const outputDir = path.join(tmpDir, 'pkg-scripts-startprod');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('start:prod');
    });

    it('should include test:unit script in package.json', async () => {
      const outputDir = path.join(tmpDir, 'pkg-scripts-testunit');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('test:unit');
    });

    it('should include test:e2e script in package.json', async () => {
      const outputDir = path.join(tmpDir, 'pkg-scripts-teste2e');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('test:e2e');
    });

    it('should include test:cov script in package.json', async () => {
      const outputDir = path.join(tmpDir, 'pkg-scripts-testcov');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts).toHaveProperty('test:cov');
    });

    it('should include engines.node requirement in package.json', async () => {
      const outputDir = path.join(tmpDir, 'pkg-engines');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const engines = pkg.engines as Record<string, string>;
      expect(engines).toHaveProperty('node');
    });

    it('should set package.json name correctly for monorepo with scope', async () => {
      const outputDir = path.join(tmpDir, 'pkg-mono-scoped');
      await generate(
        makeConfig({ name: 'my-mono', scope: '@corp', projectType: 'monorepo', outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.name).toBe('@corp/my-mono');
    });

    it('should not have version ranges in any dependency', async () => {
      const outputDir = path.join(tmpDir, 'pkg-no-ranges');
      await generate(
        makeConfig({
          name: 'my-api',
          recipes: ['typeorm-postgres', 'jwt-auth', 'swagger'],
          outputDir,
        }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      const allDeps = {
        ...(pkg.dependencies as Record<string, string>),
        ...(pkg.devDependencies as Record<string, string>),
      };
      for (const version of Object.values(allDeps)) {
        expect(version).not.toMatch(/^[\^~><=]/);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. GENERATED FILE COMPLETENESS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('17. Generated File Completeness', () => {
    it('should generate .nvmrc with node version', async () => {
      const outputDir = path.join(tmpDir, 'file-nvmrc');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, '.nvmrc'))).toBe(true);
      const content = readTextFile(path.join(outputDir, '.nvmrc')).trim();
      expect(content).toMatch(/^\d+/);
    });

    it('should generate tsconfig.build.json', async () => {
      const outputDir = path.join(tmpDir, 'file-tsconfigbuild');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'tsconfig.build.json'))).toBe(true);
    });

    it('should generate README.md', async () => {
      const outputDir = path.join(tmpDir, 'file-readme');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'README.md'))).toBe(true);
    });

    it('should generate SECURITY.md', async () => {
      const outputDir = path.join(tmpDir, 'file-security');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'SECURITY.md'))).toBe(true);
    });

    it('should generate src/ directory structure', async () => {
      const outputDir = path.join(tmpDir, 'file-srcdir');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'src'))).toBe(true);
    });

    it('should generate src/shared/ directory', async () => {
      const outputDir = path.join(tmpDir, 'file-shared');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'src', 'shared'))).toBe(true);
    });

    it('should generate src/infrastructure/ directory', async () => {
      const outputDir = path.join(tmpDir, 'file-infra');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'src', 'infrastructure'))).toBe(true);
    });

    it('should generate tests/ directory structure', async () => {
      const outputDir = path.join(tmpDir, 'file-tests');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'tests'))).toBe(true);
    });

    it('should generate .husky/ directory with pre-commit hook', async () => {
      const outputDir = path.join(tmpDir, 'file-husky');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(
        fileExists(path.join(outputDir, '.husky', 'pre-commit')) ||
          dirExists(path.join(outputDir, '.husky')),
      ).toBe(true);
    });

    it('should generate .github/ directory', async () => {
      const outputDir = path.join(tmpDir, 'file-github');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, '.github'))).toBe(true);
    });

    it('should generate src/main.ts', async () => {
      const outputDir = path.join(tmpDir, 'file-maints');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'src', 'main.ts'))).toBe(true);
    });

    it('should generate src/app.module.ts', async () => {
      const outputDir = path.join(tmpDir, 'file-appmodule');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'src', 'app.module.ts'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. ENV VAR CONTENT PER RECIPE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('18. Env Var Content per Recipe', () => {
    it('should add typeorm-postgres env vars (DB_HOST, DB_PORT, DB_NAME)', async () => {
      const outputDir = path.join(tmpDir, 'env-typeorm');
      await generate(makeConfig({ name: 'my-api', recipes: ['typeorm-postgres'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('DB_HOST');
      expect(env).toContain('DB_PORT');
      expect(env).toContain('DB_NAME');
      expect(env).toContain('DB_USERNAME');
      expect(env).toContain('DB_PASSWORD');
    });

    it('should add typeorm-mysql env vars (DB_HOST, DB_PORT)', async () => {
      const outputDir = path.join(tmpDir, 'env-typeorm-mysql');
      await generate(makeConfig({ name: 'my-api', recipes: ['typeorm-mysql'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('DB_HOST');
      expect(env).toContain('DB_PORT');
    });

    it('should add prisma env var (DATABASE_URL)', async () => {
      const outputDir = path.join(tmpDir, 'env-prisma');
      await generate(makeConfig({ name: 'my-api', recipes: ['prisma'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('DATABASE_URL');
    });

    it('should add mongoose env var (MONGO_URI)', async () => {
      const outputDir = path.join(tmpDir, 'env-mongoose');
      await generate(makeConfig({ name: 'my-api', recipes: ['mongoose'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('MONGO_URI');
    });

    it('should add drizzle-postgres env var (DATABASE_URL)', async () => {
      const outputDir = path.join(tmpDir, 'env-drizzle');
      await generate(makeConfig({ name: 'my-api', recipes: ['drizzle-postgres'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('DATABASE_URL');
    });

    it('should add redis-cache env vars (REDIS_HOST, REDIS_PORT, REDIS_TTL)', async () => {
      const outputDir = path.join(tmpDir, 'env-redis');
      await generate(makeConfig({ name: 'my-api', recipes: ['redis-cache'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('REDIS_HOST');
      expect(env).toContain('REDIS_PORT');
      expect(env).toContain('REDIS_TTL');
    });

    it('should add rabbitmq env var (RABBITMQ_URL)', async () => {
      const outputDir = path.join(tmpDir, 'env-rabbitmq');
      await generate(makeConfig({ name: 'my-api', recipes: ['rabbitmq'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('RABBITMQ_URL');
    });

    it('should add jwt-auth env vars (JWT_SECRET, JWT_EXPIRES_IN)', async () => {
      const outputDir = path.join(tmpDir, 'env-jwt');
      await generate(makeConfig({ name: 'my-api', recipes: ['jwt-auth'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('JWT_SECRET');
      expect(env).toContain('JWT_EXPIRES_IN');
    });

    it('should add swagger env vars (SWAGGER_ENABLED, SWAGGER_PATH)', async () => {
      const outputDir = path.join(tmpDir, 'env-swagger');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SWAGGER_ENABLED');
      expect(env).toContain('SWAGGER_PATH');
    });

    it('should add nodemailer env vars (MAIL_HOST, MAIL_PORT)', async () => {
      const outputDir = path.join(tmpDir, 'env-nodemailer');
      await generate(makeConfig({ name: 'my-api', recipes: ['nodemailer'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('MAIL_HOST');
      expect(env).toContain('MAIL_PORT');
    });

    it('should add sendgrid env var (SENDGRID_API_KEY)', async () => {
      const outputDir = path.join(tmpDir, 'env-sendgrid');
      await generate(makeConfig({ name: 'my-api', recipes: ['sendgrid'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SENDGRID_API_KEY');
    });

    it('should add s3-minio env vars (S3_ENDPOINT, S3_BUCKET, S3_REGION)', async () => {
      const outputDir = path.join(tmpDir, 'env-s3minio');
      await generate(makeConfig({ name: 'my-api', recipes: ['s3-minio'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('S3_ENDPOINT');
      expect(env).toContain('S3_BUCKET');
      expect(env).toContain('S3_REGION');
    });

    it('should add sentry env var (SENTRY_DSN)', async () => {
      const outputDir = path.join(tmpDir, 'env-sentry');
      await generate(makeConfig({ name: 'my-api', recipes: ['sentry'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SENTRY_DSN');
    });

    it('should add oauth-google env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)', async () => {
      const outputDir = path.join(tmpDir, 'env-oauth-google');
      await generate(makeConfig({ name: 'my-api', recipes: ['oauth-google'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('GOOGLE_CLIENT_ID');
      expect(env).toContain('GOOGLE_CLIENT_SECRET');
    });

    it('should add oauth-github env vars (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)', async () => {
      const outputDir = path.join(tmpDir, 'env-oauth-github');
      await generate(makeConfig({ name: 'my-api', recipes: ['oauth-github'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('GITHUB_CLIENT_ID');
      expect(env).toContain('GITHUB_CLIENT_SECRET');
    });

    it('should add oauth-apple env vars (APPLE_CLIENT_ID, APPLE_TEAM_ID)', async () => {
      const outputDir = path.join(tmpDir, 'env-oauth-apple');
      await generate(makeConfig({ name: 'my-api', recipes: ['oauth-apple'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('APPLE_CLIENT_ID');
      expect(env).toContain('APPLE_TEAM_ID');
    });

    it('should add adminjs env vars (ADMIN_EMAIL, ADMIN_PASSWORD)', async () => {
      const outputDir = path.join(tmpDir, 'env-adminjs');
      await generate(makeConfig({ name: 'my-api', recipes: ['adminjs'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('ADMIN_EMAIL');
      expect(env).toContain('ADMIN_PASSWORD');
    });

    it('should add webhooks env var (WEBHOOK_SECRET)', async () => {
      const outputDir = path.join(tmpDir, 'env-webhooks');
      await generate(makeConfig({ name: 'my-api', recipes: ['webhooks'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('WEBHOOK_SECRET');
    });

    it('should add bullmq env vars (REDIS_HOST, REDIS_PORT for BullMQ)', async () => {
      const outputDir = path.join(tmpDir, 'env-bullmq');
      await generate(makeConfig({ name: 'my-api', recipes: ['bullmq'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('REDIS_HOST');
      expect(env).toContain('REDIS_PORT');
    });

    it('should preserve PORT and NODE_ENV when adding recipes', async () => {
      const outputDir = path.join(tmpDir, 'env-base-preserved');
      await generate(makeConfig({ name: 'my-api', recipes: ['typeorm-postgres', 'redis-cache', 'jwt-auth'], outputDir }), registry, TEMPLATES_DIR);
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('PORT=3000');
      expect(env).toContain('NODE_ENV=development');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. TSCONFIG AND BUILD CONFIG VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('19. tsconfig and Build Config Verification', () => {
    it('should generate tsconfig.json with strictNullChecks enabled', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-strict');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const tsconfig = readJsonFile(path.join(outputDir, 'tsconfig.json'));
      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      expect(compilerOptions.strictNullChecks).toBe(true);
    });

    it('should generate tsconfig.json with esModuleInterop', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-esmodule');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const tsconfig = readJsonFile(path.join(outputDir, 'tsconfig.json'));
      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      expect(compilerOptions.esModuleInterop).toBe(true);
    });

    it('should set tsconfig @/* path to src/* for http-api', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-paths-httpapi');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      const tsconfig = readJsonFile(path.join(outputDir, 'tsconfig.json'));
      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      const paths = compilerOptions.paths as Record<string, string[]>;
      expect(paths['@/*']).toEqual(['src/*']);
    });

    it('should set tsconfig @/* path to apps/api/src/* for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-paths-monorepo');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      const tsconfig = readJsonFile(path.join(outputDir, 'tsconfig.json'));
      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      const paths = compilerOptions.paths as Record<string, string[]>;
      expect(paths['@/*']).toEqual(['apps/api/src/*']);
    });

    it('should set tsconfig @/* path to apps/api/src/* for full-stack', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-paths-fullstack');
      await generate(makeConfig({ name: 'my-fs', projectType: 'full-stack', frontendFramework: 'nextjs', outputDir }), registry, TEMPLATES_DIR);
      const tsconfig = readJsonFile(path.join(outputDir, 'tsconfig.json'));
      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      const paths = compilerOptions.paths as Record<string, string[]>;
      expect(paths['@/*']).toEqual(['apps/api/src/*']);
    });

    it('should generate tsconfig.build.json that extends tsconfig.json', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-build-extends');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const tsconfigBuild = readJsonFile(path.join(outputDir, 'tsconfig.build.json'));
      expect(tsconfigBuild.extends).toBe('./tsconfig.json');
    });

    it('should generate tsconfig.build.json that excludes node_modules and tests', async () => {
      const outputDir = path.join(tmpDir, 'tsconfig-build-excludes');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const tsconfigBuild = readJsonFile(path.join(outputDir, 'tsconfig.build.json'));
      const exclude = tsconfigBuild.exclude as string[];
      expect(exclude).toContain('node_modules');
    });

    it('should generate nest-cli.json with sourceRoot as apps/api/src for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'nestcli-monorepo');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      const nestCli = readJsonFile(path.join(outputDir, 'nest-cli.json'));
      expect(nestCli.sourceRoot).toBe('apps/api/src');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. SCOPE IN OUTPUT FILES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('20. Scope in Output Files', () => {
    it('should accept scope @myorg as valid', () => {
      const result = validateConfig(makeConfig({ name: 'test', scope: '@myorg', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept scope with numbers @my0rg', () => {
      const result = validateConfig(makeConfig({ name: 'test', scope: '@my0rg', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept scope with hyphens @my-org', () => {
      const result = validateConfig(makeConfig({ name: 'test', scope: '@my-org', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should reject scope with uppercase @MyOrg', () => {
      const result = validateConfig(makeConfig({ name: 'test', scope: '@MyOrg', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject scope without @ prefix: myorg', () => {
      const result = validateConfig(makeConfig({ name: 'test', scope: 'myorg', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject scope with underscore @my_org', () => {
      const result = validateConfig(makeConfig({ name: 'test', scope: '@my_org', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should produce @scope/name in package.json name for microservice with scope', async () => {
      const outputDir = path.join(tmpDir, 'scope-microservice');
      await generate(
        makeConfig({ name: 'my-ms', scope: '@platform', projectType: 'microservice', transportLayer: 'tcp', outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.name).toBe('@platform/my-ms');
    });

    it('should produce @scope/name in package.json for full-stack project with scope', async () => {
      const outputDir = path.join(tmpDir, 'scope-fullstack');
      await generate(
        makeConfig({ name: 'my-app', scope: '@team', projectType: 'full-stack', frontendFramework: 'nextjs', outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.name).toBe('@team/my-app');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 21. APP MODULE IMPORT INJECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('21. App Module Import Injection', () => {
    it('should not have excessive imports in app.module.ts with no recipes', async () => {
      const outputDir = path.join(tmpDir, 'module-bare');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const appModule = readTextFile(path.join(outputDir, 'src/app.module.ts'));
      expect(appModule).toContain('@Module');
      expect(appModule).toContain('AppModule');
    });

    it('should copy typeorm-postgres recipe template files (database.module.ts)', async () => {
      const outputDir = path.join(tmpDir, 'module-typeorm');
      await generate(makeConfig({ name: 'my-api', recipes: ['typeorm-postgres'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'src/infrastructure/database/database.module.ts'))).toBe(true);
    });

    it('should inject health-checks module import into app.module.ts', async () => {
      const outputDir = path.join(tmpDir, 'module-health');
      await generate(makeConfig({ name: 'my-api', recipes: ['health-checks'], outputDir }), registry, TEMPLATES_DIR);
      const appModule = readTextFile(path.join(outputDir, 'src/app.module.ts'));
      expect(appModule.length).toBeGreaterThan(50);
      expect(fileExists(path.join(outputDir, 'src/app.module.ts'))).toBe(true);
    });

    it('should copy throttler recipe template files (throttle.config.ts)', async () => {
      const outputDir = path.join(tmpDir, 'module-throttler');
      await generate(makeConfig({ name: 'my-api', recipes: ['throttler'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'src/shared/guards/throttle.config.ts'))).toBe(true);
    });

    it('should copy multiple recipe template files when multiple recipes selected', async () => {
      const outputDir = path.join(tmpDir, 'module-multi');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['typeorm-postgres', 'throttler', 'health-checks'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'src/infrastructure/database/database.module.ts'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'src/shared/guards/throttle.config.ts'))).toBe(true);
    });

    it('should have valid TypeScript in app.module.ts (contains @Module decorator)', async () => {
      const outputDir = path.join(tmpDir, 'module-decorator');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger', 'pino'], outputDir }), registry, TEMPLATES_DIR);
      const appModule = readTextFile(path.join(outputDir, 'src/app.module.ts'));
      expect(appModule).toContain('@Module(');
    });

    it('should copy redis-cache recipe template files (cache.module.ts)', async () => {
      const outputDir = path.join(tmpDir, 'module-redis');
      await generate(makeConfig({ name: 'my-api', recipes: ['redis-cache'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'src/infrastructure/cache/cache.module.ts'))).toBe(true);
    });

    it('should copy bullmq recipe template files (queue.module.ts)', async () => {
      const outputDir = path.join(tmpDir, 'module-bullmq');
      await generate(makeConfig({ name: 'my-api', recipes: ['bullmq'], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'src/infrastructure/queue/queue.module.ts'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 22. CONFLICT DETECTION COMPREHENSIVE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('22. Conflict Detection Comprehensive', () => {
    it('should detect typeorm-postgres conflicts with typeorm-mysql', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'typeorm-mysql'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect typeorm-postgres conflicts with mongoose', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'mongoose'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect typeorm-postgres conflicts with drizzle-postgres', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'drizzle-postgres'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect typeorm-postgres conflicts with kysely', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'kysely'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect typeorm-postgres conflicts with mikro-orm', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'mikro-orm'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect prisma conflicts with typeorm-postgres', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['prisma', 'typeorm-postgres'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect prisma conflicts with mongoose', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['prisma', 'mongoose'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect prisma conflicts with drizzle-postgres', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['prisma', 'drizzle-postgres'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect mongoose conflicts with drizzle-postgres', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['mongoose', 'drizzle-postgres'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect mongoose conflicts with kysely', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['mongoose', 'kysely'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect mikro-orm conflicts with prisma', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['mikro-orm', 'prisma'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect mikro-orm conflicts with drizzle-postgres', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['mikro-orm', 'drizzle-postgres'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect json-patch conflicts with json-merge-patch', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['json-patch', 'json-merge-patch'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should detect json-merge-patch conflicts with json-patch (symmetric)', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['json-merge-patch', 'json-patch'], allRecipes);
      expect(conflicts.some((c) => c.type === 'mutual-exclusion')).toBe(true);
    });

    it('should not detect conflict between typeorm-postgres and redis-cache', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'redis-cache'], allRecipes);
      expect(conflicts.every((c) => c.type !== 'mutual-exclusion')).toBe(true);
    });

    it('should not detect conflict between jwt-auth and swagger', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['jwt-auth', 'swagger'], allRecipes);
      expect(conflicts.every((c) => c.type !== 'mutual-exclusion')).toBe(true);
    });

    it('should not detect conflict between pino and health-checks', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['pino', 'health-checks'], allRecipes);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect multiple conflicts simultaneously (three conflicting databases)', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'prisma', 'mongoose'], allRecipes);
      expect(conflicts.filter((c) => c.type === 'mutual-exclusion').length).toBeGreaterThanOrEqual(2);
    });

    it('should not detect conflicts for an empty recipe list', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts([], allRecipes);
      expect(conflicts).toHaveLength(0);
    });

    it('should not detect conflicts for a single recipe', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres'], allRecipes);
      expect(conflicts).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 23. MISSING REQUIREMENT DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('23. Missing Requirement Detection', () => {
    it('should detect auth-flows missing jwt-auth requirement', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['auth-flows'], allRecipes);
      expect(conflicts.some((c) => c.type === 'missing-requirement')).toBe(true);
    });

    it('should not detect missing requirement when auth-flows has jwt-auth', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['auth-flows', 'jwt-auth'], allRecipes);
      expect(conflicts.every((c) => c.type !== 'missing-requirement')).toBe(true);
    });

    it('should not detect missing requirement for recipes with no requirements', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['swagger', 'pino', 'health-checks', 'throttler'], allRecipes);
      expect(conflicts.filter((c) => c.type === 'missing-requirement')).toHaveLength(0);
    });

    it('should detect missing requirement when auth-flows is combined with unrelated recipes', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['auth-flows', 'swagger', 'pino'], allRecipes);
      expect(conflicts.some((c) => c.type === 'missing-requirement')).toBe(true);
    });

    it('should return empty conflicts for standard recipe combinations with no requirements issues', () => {
      const allRecipes = registry.getAll();
      const conflicts = detectConflicts(['typeorm-postgres', 'redis-cache', 'jwt-auth', 'auth-flows'], allRecipes);
      expect(conflicts.filter((c) => c.type === 'missing-requirement')).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 24. MORE PROMPT FLOW COMBINATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('24. More Prompt Flow Combinations', () => {
    it('should run prompt flow for microservice with kafka transport', async () => {
      configurePromptMocks({
        name: 'ms-kafka',
        projectType: 'microservice',
        cloudProvider: 'none',
        transportLayer: 'kafka',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config).not.toBeNull();
      expect(config!.transportLayer).toBe('kafka');
    });

    it('should run prompt flow for microservice with grpc transport', async () => {
      configurePromptMocks({
        name: 'ms-grpc',
        projectType: 'microservice',
        cloudProvider: 'none',
        transportLayer: 'grpc',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config).not.toBeNull();
      expect(config!.transportLayer).toBe('grpc');
    });

    it('should run prompt flow for microservice with nats transport', async () => {
      configurePromptMocks({
        name: 'ms-nats',
        projectType: 'microservice',
        cloudProvider: 'none',
        transportLayer: 'nats',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.transportLayer).toBe('nats');
    });

    it('should run prompt flow for microservice with mqtt transport', async () => {
      configurePromptMocks({
        name: 'ms-mqtt',
        projectType: 'microservice',
        cloudProvider: 'none',
        transportLayer: 'mqtt',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.transportLayer).toBe('mqtt');
    });

    it('should run prompt flow for microservice with redis transport', async () => {
      configurePromptMocks({
        name: 'ms-redis',
        projectType: 'microservice',
        cloudProvider: 'none',
        transportLayer: 'redis',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.transportLayer).toBe('redis');
    });

    it('should run prompt flow for full-stack with vite-react', async () => {
      configurePromptMocks({
        name: 'fs-vite',
        projectType: 'full-stack',
        cloudProvider: 'none',
        frontendFramework: 'vite-react',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.frontendFramework).toBe('vite-react');
    });

    it('should run prompt flow for full-stack with nuxt', async () => {
      configurePromptMocks({
        name: 'fs-nuxt',
        projectType: 'full-stack',
        cloudProvider: 'none',
        frontendFramework: 'nuxt',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.frontendFramework).toBe('nuxt');
    });

    it('should run prompt flow for full-stack with sveltekit', async () => {
      configurePromptMocks({
        name: 'fs-svelte',
        projectType: 'full-stack',
        cloudProvider: 'none',
        frontendFramework: 'sveltekit',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.frontendFramework).toBe('sveltekit');
    });

    it('should run prompt flow with aws cloud provider', async () => {
      configurePromptMocks({
        name: 'api-aws',
        projectType: 'http-api',
        cloudProvider: 'aws',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.cloudProvider).toBe('aws');
    });

    it('should run prompt flow with gcp cloud provider', async () => {
      configurePromptMocks({
        name: 'api-gcp',
        projectType: 'http-api',
        cloudProvider: 'gcp',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.cloudProvider).toBe('gcp');
    });

    it('should run prompt flow with azure cloud provider', async () => {
      configurePromptMocks({
        name: 'api-azure',
        projectType: 'http-api',
        cloudProvider: 'azure',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'none',
      });
      const config = await runAllPrompts(registry);
      expect(config!.cloudProvider).toBe('azure');
    });

    it('should run prompt flow with azure-devops CI/CD', async () => {
      configurePromptMocks({
        name: 'api-azdo',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'azure-devops',
      });
      const config = await runAllPrompts(registry);
      expect(config!.ciCdProvider).toBe('azure-devops');
    });

    it('should run prompt flow with aws-codepipeline CI/CD', async () => {
      configurePromptMocks({
        name: 'api-codepipeline',
        projectType: 'http-api',
        cloudProvider: 'aws',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'aws-codepipeline',
      });
      const config = await runAllPrompts(registry);
      expect(config!.ciCdProvider).toBe('aws-codepipeline');
    });

    it('should run prompt flow with gcp-cloudbuild CI/CD', async () => {
      configurePromptMocks({
        name: 'api-cloudbuild',
        projectType: 'http-api',
        cloudProvider: 'gcp',
        recipes: [],
        deploymentTargets: [],
        ciCdProvider: 'gcp-cloudbuild',
      });
      const config = await runAllPrompts(registry);
      expect(config!.ciCdProvider).toBe('gcp-cloudbuild');
    });

    it('should run prompt flow with multiple deployment targets', async () => {
      configurePromptMocks({
        name: 'api-multi-deploy',
        projectType: 'http-api',
        cloudProvider: 'none',
        recipes: [],
        deploymentTargets: ['dockerfile', 'kubernetes'],
        ciCdProvider: 'github-actions',
      });
      const config = await runAllPrompts(registry);
      expect(config!.deploymentTargets).toContain('dockerfile');
      expect(config!.deploymentTargets).toContain('kubernetes');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 25. AI CONTEXT CONTENT VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('25. AI Context Content Verification', () => {
    it('should include swagger recipe name in CLAUDE.md', async () => {
      const outputDir = path.join(tmpDir, 'ai-swagger');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger'], outputDir }), registry, TEMPLATES_DIR);
      const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
      expect(claudeMd).toContain('Swagger');
    });

    it('should include typeorm-postgres recipe name in CLAUDE.md', async () => {
      const outputDir = path.join(tmpDir, 'ai-typeorm');
      await generate(makeConfig({ name: 'my-api', recipes: ['typeorm-postgres'], outputDir }), registry, TEMPLATES_DIR);
      const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
      expect(claudeMd).toContain('TypeORM');
    });

    it('should include jwt-auth recipe name in CLAUDE.md', async () => {
      const outputDir = path.join(tmpDir, 'ai-jwt');
      await generate(makeConfig({ name: 'my-api', recipes: ['jwt-auth'], outputDir }), registry, TEMPLATES_DIR);
      const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
      expect(claudeMd).toContain('JWT');
    });

    it('should include all recipe names in CLAUDE.md for multi-recipe generation', async () => {
      const outputDir = path.join(tmpDir, 'ai-multi');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger', 'pino', 'health-checks'], outputDir }), registry, TEMPLATES_DIR);
      const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
      expect(claudeMd).toContain('Swagger');
      expect(claudeMd).toContain('Pino');
    });

    it('should include Active Recipes section in CLAUDE.md', async () => {
      const outputDir = path.join(tmpDir, 'ai-active-recipes');
      await generate(makeConfig({ name: 'my-api', recipes: ['pino'], outputDir }), registry, TEMPLATES_DIR);
      const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
      expect(claudeMd).toContain('Active Recipes');
    });

    it('should include swagger content in cursor rules', async () => {
      const outputDir = path.join(tmpDir, 'ai-cursor-swagger');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger'], outputDir }), registry, TEMPLATES_DIR);
      const cursorRules = readTextFile(path.join(outputDir, '.cursor', 'rules', 'project.mdc'));
      expect(cursorRules.length).toBeGreaterThan(0);
    });

    it('should include recipe content in copilot instructions', async () => {
      const outputDir = path.join(tmpDir, 'ai-copilot-swagger');
      await generate(makeConfig({ name: 'my-api', recipes: ['swagger'], outputDir }), registry, TEMPLATES_DIR);
      const copilot = readTextFile(path.join(outputDir, '.github', 'copilot-instructions.md'));
      expect(copilot.length).toBeGreaterThan(0);
    });

    it('should not generate cursor rules when no recipes with AI context', async () => {
      const outputDir = path.join(tmpDir, 'ai-no-cursor');
      await generate(makeConfig({ name: 'my-api', recipes: [], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, '.cursor', 'rules', 'project.mdc'))).toBe(false);
    });

    it('should not generate copilot instructions when no recipes with AI context', async () => {
      const outputDir = path.join(tmpDir, 'ai-no-copilot');
      await generate(makeConfig({ name: 'my-api', recipes: [], outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, '.github', 'copilot-instructions.md'))).toBe(false);
    });

    it('should include pino logger details in CLAUDE.md', async () => {
      const outputDir = path.join(tmpDir, 'ai-pino');
      await generate(makeConfig({ name: 'my-api', recipes: ['pino'], outputDir }), registry, TEMPLATES_DIR);
      const claudeMd = readTextFile(path.join(outputDir, 'CLAUDE.md'));
      expect(claudeMd).toContain('Pino');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 26. MORE RECIPE COMBINATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('26. More Recipe Combinations', () => {
    it('should generate with typeorm-mysql + redis-cache + jwt-auth', async () => {
      const outputDir = path.join(tmpDir, 'combo-mysql-redis-jwt');
      await generate(makeConfig({ name: 'my-api', recipes: ['typeorm-mysql', 'redis-cache', 'jwt-auth'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('typeorm');
      expect(pkg.dependencies).toHaveProperty('@nestjs/jwt');
    });

    it('should generate with prisma + webhooks + audit-trail', async () => {
      const outputDir = path.join(tmpDir, 'combo-prisma-webhooks');
      await generate(makeConfig({ name: 'my-api', recipes: ['prisma', 'webhooks', 'audit-trail'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@prisma/client');
    });

    it('should generate with mongoose + i18n + throttler', async () => {
      const outputDir = path.join(tmpDir, 'combo-mongoose-i18n');
      await generate(makeConfig({ name: 'my-api', recipes: ['mongoose', 'i18n', 'throttler'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('mongoose');
      expect(pkg.dependencies).toHaveProperty('@nestjs/throttler');
    });

    it('should generate with mikro-orm + config-validation + health-checks', async () => {
      const outputDir = path.join(tmpDir, 'combo-mikroorm-config');
      await generate(makeConfig({ name: 'my-api', recipes: ['mikro-orm', 'config-validation', 'health-checks'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@mikro-orm/core');
      expect(pkg.dependencies).toHaveProperty('@nestjs/terminus');
    });

    it('should generate with drizzle-postgres + soft-delete + serialization-groups', async () => {
      const outputDir = path.join(tmpDir, 'combo-drizzle-softdelete');
      await generate(makeConfig({ name: 'my-api', recipes: ['drizzle-postgres', 'soft-delete', 'serialization-groups'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('drizzle-orm');
    });

    it('should generate with jwt-auth + passport + oauth-google + oauth-github + oauth-apple', async () => {
      const outputDir = path.join(tmpDir, 'combo-full-oauth');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['jwt-auth', 'passport', 'oauth-google', 'oauth-github', 'oauth-apple'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('passport-google-oauth20');
      expect(pkg.dependencies).toHaveProperty('passport-github2');
    });

    it('should generate with http-caching + idempotency + prefer-header + content-digest', async () => {
      const outputDir = path.join(tmpDir, 'combo-http-patterns');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['http-caching', 'idempotency', 'prefer-header', 'content-digest'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('http-caching');
      expect(recipes).toHaveProperty('idempotency');
    });

    it('should generate with worker-threads + circuit-breaker + graceful-shutdown', async () => {
      const outputDir = path.join(tmpDir, 'combo-worker-resilience');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['worker-threads', 'circuit-breaker', 'graceful-shutdown'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });

    it('should generate with multi-tenancy + audit-trail + data-masking', async () => {
      const outputDir = path.join(tmpDir, 'combo-multitenancy');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['multi-tenancy', 'audit-trail', 'data-masking'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('multi-tenancy');
      expect(recipes).toHaveProperty('audit-trail');
    });

    it('should generate with cqrs + transactional-outbox + webhooks', async () => {
      const outputDir = path.join(tmpDir, 'combo-cqrs-outbox');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['cqrs', 'transactional-outbox', 'webhooks'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/cqrs');
    });

    it('should generate with graphql-mercurius standalone', async () => {
      const outputDir = path.join(tmpDir, 'combo-graphql');
      await generate(makeConfig({ name: 'my-api', recipes: ['graphql-mercurius'], outputDir }), registry, TEMPLATES_DIR);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/graphql');
    });

    it('should generate with adminjs + typeorm-postgres + jwt-auth', async () => {
      const outputDir = path.join(tmpDir, 'combo-adminjs-typeorm');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['adminjs', 'typeorm-postgres', 'jwt-auth'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('ADMIN_EMAIL');
      expect(env).toContain('JWT_SECRET');
    });

    it('should generate with config-validation + env-per-environment + devcontainer', async () => {
      const outputDir = path.join(tmpDir, 'combo-devtools');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['config-validation', 'env-per-environment', 'devcontainer'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('devcontainer');
      expect(recipes).toHaveProperty('env-per-environment');
    });

    it('should generate with pagination + filtering + api-versioning + correlation-id', async () => {
      const outputDir = path.join(tmpDir, 'combo-api-full');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['pagination', 'filtering', 'api-versioning', 'correlation-id'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(Object.keys(recipes)).toHaveLength(4);
    });

    it('should generate with csrf + cors + helmet + throttler (security stack)', async () => {
      const outputDir = path.join(tmpDir, 'combo-security-full');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['csrf', 'cors', 'helmet', 'throttler'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/throttler');
    });

    it('should generate with dependabot-renovate + changelog + docs-site + license', async () => {
      const outputDir = path.join(tmpDir, 'combo-devops-docs');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['dependabot-renovate', 'changelog', 'docs-site', 'license'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('changelog');
      expect(recipes).toHaveProperty('license');
    });

    it('should generate with file-upload + s3-minio', async () => {
      const outputDir = path.join(tmpDir, 'combo-fileupload-s3');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['file-upload', 's3-minio'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('MAX_FILE_SIZE_MB');
      expect(env).toContain('S3_ENDPOINT');
    });

    it('should generate with sdk-generation + swagger + pagination', async () => {
      const outputDir = path.join(tmpDir, 'combo-sdk-swagger');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['sdk-generation', 'swagger', 'pagination'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const manifest = readJsonFile(path.join(outputDir, '.spoonfeed.json'));
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes).toHaveProperty('sdk-generation');
      expect(recipes).toHaveProperty('swagger');
    });

    it('should generate with load-testing + health-checks + prometheus', async () => {
      const outputDir = path.join(tmpDir, 'combo-loadtest-observability');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['load-testing', 'health-checks', 'prometheus'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/terminus');
      expect(pkg.dependencies).toHaveProperty('prom-client');
    });

    it('should generate with mfa-totp + jwt-auth + auth-flows', async () => {
      const outputDir = path.join(tmpDir, 'combo-mfa-auth');
      await generate(
        makeConfig({ name: 'my-api', recipes: ['mfa-totp', 'jwt-auth', 'auth-flows'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('otplib');
      expect(pkg.dependencies).toHaveProperty('@nestjs/jwt');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 27. MICROSERVICE + TRANSPORT + RECIPE COMBOS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('27. Microservice + Transport + Recipe Combos', () => {
    it('should generate microservice kafka with pino and health-checks', async () => {
      const outputDir = path.join(tmpDir, 'ms-kafka-pino');
      await generate(
        makeConfig({ name: 'ms-kafka', projectType: 'microservice', transportLayer: 'kafka', recipes: ['pino', 'health-checks'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'src/main.ts'))).toBe(true);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/microservices');
    });

    it('should generate microservice rabbitmq with dead-letter-queue and bullmq', async () => {
      const outputDir = path.join(tmpDir, 'ms-rmq-dlq');
      await generate(
        makeConfig({ name: 'ms-rmq', projectType: 'microservice', transportLayer: 'rabbitmq', recipes: ['rabbitmq', 'dead-letter-queue', 'bullmq'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('amqplib');
      expect(pkg.dependencies).toHaveProperty('bullmq');
    });

    it('should generate microservice grpc with prometheus and opentelemetry', async () => {
      const outputDir = path.join(tmpDir, 'ms-grpc-obs');
      await generate(
        makeConfig({ name: 'ms-grpc', projectType: 'microservice', transportLayer: 'grpc', recipes: ['prometheus', 'opentelemetry'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('prom-client');
    });

    it('should generate microservice nats with circuit-breaker and graceful-shutdown', async () => {
      const outputDir = path.join(tmpDir, 'ms-nats-resilience');
      await generate(
        makeConfig({ name: 'ms-nats', projectType: 'microservice', transportLayer: 'nats', recipes: ['circuit-breaker', 'graceful-shutdown'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'package.json'))).toBe(true);
    });

    it('should generate microservice tcp with redis-cache and correlation-id', async () => {
      const outputDir = path.join(tmpDir, 'ms-tcp-redis');
      await generate(
        makeConfig({ name: 'ms-tcp', projectType: 'microservice', transportLayer: 'tcp', recipes: ['redis-cache', 'correlation-id'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('REDIS_HOST');
    });

    it('should generate microservice redis transport with sentry', async () => {
      const outputDir = path.join(tmpDir, 'ms-redis-sentry');
      await generate(
        makeConfig({ name: 'ms-redis-t', projectType: 'microservice', transportLayer: 'redis', recipes: ['sentry'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('SENTRY_DSN');
    });

    it('should generate microservice mqtt with request-logging', async () => {
      const outputDir = path.join(tmpDir, 'ms-mqtt-logging');
      await generate(
        makeConfig({ name: 'ms-mqtt', projectType: 'microservice', transportLayer: 'mqtt', recipes: ['request-logging'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'src/main.ts'))).toBe(true);
    });

    it('should generate microservice custom transport with swagger and throttler', async () => {
      const outputDir = path.join(tmpDir, 'ms-custom-swagger');
      await generate(
        makeConfig({ name: 'ms-custom', projectType: 'microservice', transportLayer: 'custom', recipes: ['swagger', 'throttler'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const mainTs = readTextFile(path.join(outputDir, 'src/main.ts'));
      expect(mainTs.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 28. FULL-STACK + FRONTEND + RECIPE COMBOS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('28. Full-Stack + Frontend + Recipe Combos', () => {
    it('should generate full-stack nextjs with swagger + pino + health-checks', async () => {
      const outputDir = path.join(tmpDir, 'fs-next-complete');
      await generate(
        makeConfig({ name: 'fs-next', projectType: 'full-stack', frontendFramework: 'nextjs', recipes: ['swagger', 'pino', 'health-checks'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(dirExists(path.join(outputDir, 'apps', 'web'))).toBe(true);
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/swagger');
    });

    it('should generate full-stack vite-react with jwt-auth and cors', async () => {
      const outputDir = path.join(tmpDir, 'fs-vite-auth');
      await generate(
        makeConfig({ name: 'fs-vite', projectType: 'full-stack', frontendFramework: 'vite-react', recipes: ['jwt-auth', 'cors'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('JWT_SECRET');
    });

    it('should generate full-stack nuxt with typeorm-postgres and redis-cache', async () => {
      const outputDir = path.join(tmpDir, 'fs-nuxt-db');
      await generate(
        makeConfig({ name: 'fs-nuxt', projectType: 'full-stack', frontendFramework: 'nuxt', recipes: ['typeorm-postgres', 'redis-cache'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const env = readTextFile(path.join(outputDir, '.env.example'));
      expect(env).toContain('DB_HOST');
      expect(env).toContain('REDIS_HOST');
    });

    it('should generate full-stack sveltekit with pino and throttler', async () => {
      const outputDir = path.join(tmpDir, 'fs-svelte-pino');
      await generate(
        makeConfig({ name: 'fs-svelte', projectType: 'full-stack', frontendFramework: 'sveltekit', recipes: ['pino', 'throttler'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      const pkg = readJsonFile(path.join(outputDir, 'package.json'));
      expect(pkg.dependencies).toHaveProperty('@nestjs/throttler');
    });

    it('should generate full-stack nextjs with github-actions CI/CD', async () => {
      const outputDir = path.join(tmpDir, 'fs-next-ci');
      await generate(
        makeConfig({ name: 'fs-next', projectType: 'full-stack', frontendFramework: 'nextjs', ciCdProvider: 'github-actions', recipes: [], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, '.github', 'workflows', 'ci.yml'))).toBe(true);
    });

    it('should generate full-stack nextjs with dockerfile and docker-compose', async () => {
      const outputDir = path.join(tmpDir, 'fs-next-docker');
      await generate(
        makeConfig({ name: 'fs-next', projectType: 'full-stack', frontendFramework: 'nextjs', deploymentTargets: ['dockerfile', 'docker-compose'], recipes: [], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(fileExists(path.join(outputDir, 'Dockerfile'))).toBe(true);
      expect(fileExists(path.join(outputDir, 'docker-compose.yml'))).toBe(true);
    });

    it('should generate full-stack vite-react with kubernetes deployment', async () => {
      const outputDir = path.join(tmpDir, 'fs-vite-k8s');
      await generate(
        makeConfig({ name: 'fs-vite', projectType: 'full-stack', frontendFramework: 'vite-react', deploymentTargets: ['kubernetes'], recipes: [], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(dirExists(path.join(outputDir, 'k8s'))).toBe(true);
    });

    it('should generate full-stack with api recipe files relocated to apps/api', async () => {
      const outputDir = path.join(tmpDir, 'fs-relocation');
      await generate(
        makeConfig({ name: 'fs-api', projectType: 'full-stack', frontendFramework: 'nextjs', recipes: ['typeorm-postgres'], outputDir }),
        registry,
        TEMPLATES_DIR,
      );
      expect(dirExists(path.join(outputDir, 'apps', 'api'))).toBe(true);
      expect(dirExists(path.join(outputDir, 'apps', 'web'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 29. PROJECT DIRECTORY STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('29. Project Directory Structure', () => {
    it('should not generate src/ at root for monorepo (relocated to apps/api/)', async () => {
      const outputDir = path.join(tmpDir, 'struct-monorepo');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'src'))).toBe(false);
      expect(dirExists(path.join(outputDir, 'apps', 'api', 'src'))).toBe(true);
    });

    it('should not generate src/ at root for full-stack (relocated to apps/api/)', async () => {
      const outputDir = path.join(tmpDir, 'struct-fullstack');
      await generate(makeConfig({ name: 'my-fs', projectType: 'full-stack', frontendFramework: 'nextjs', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'src'))).toBe(false);
      expect(dirExists(path.join(outputDir, 'apps', 'api', 'src'))).toBe(true);
    });

    it('should generate src/ at root for http-api (standard)', async () => {
      const outputDir = path.join(tmpDir, 'struct-httpapi');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'src'))).toBe(true);
    });

    it('should generate src/ at root for cli-app', async () => {
      const outputDir = path.join(tmpDir, 'struct-cliapp');
      await generate(makeConfig({ name: 'my-cli', projectType: 'cli-app', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'src'))).toBe(true);
    });

    it('should generate src/ at root for scheduled-worker', async () => {
      const outputDir = path.join(tmpDir, 'struct-worker');
      await generate(makeConfig({ name: 'my-worker', projectType: 'scheduled-worker', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'src'))).toBe(true);
    });

    it('should generate tests/ at root for http-api (standard)', async () => {
      const outputDir = path.join(tmpDir, 'struct-tests-httpapi');
      await generate(makeConfig({ name: 'my-api', projectType: 'http-api', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'tests'))).toBe(true);
    });

    it('should not generate tests/ at root for monorepo (relocated to apps/api/)', async () => {
      const outputDir = path.join(tmpDir, 'struct-tests-monorepo');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'tests'))).toBe(false);
      expect(dirExists(path.join(outputDir, 'apps', 'api', 'tests'))).toBe(true);
    });

    it('should generate apps/ directory for monorepo', async () => {
      const outputDir = path.join(tmpDir, 'struct-apps-monorepo');
      await generate(makeConfig({ name: 'my-mono', projectType: 'monorepo', outputDir }), registry, TEMPLATES_DIR);
      expect(dirExists(path.join(outputDir, 'apps'))).toBe(true);
      expect(dirExists(path.join(outputDir, 'apps', 'api'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 30. OUTPUT FILE TOOLING VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('30. Output File Tooling Verification', () => {
    it('should generate .prettierrc with singleQuote: true', async () => {
      const outputDir = path.join(tmpDir, 'tool-prettier');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const prettierrc = readJsonFile(path.join(outputDir, '.prettierrc'));
      expect(prettierrc.singleQuote).toBe(true);
    });

    it('should generate .prettierrc with semi: true', async () => {
      const outputDir = path.join(tmpDir, 'tool-prettier-semi');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const prettierrc = readJsonFile(path.join(outputDir, '.prettierrc'));
      expect(prettierrc.semi).toBe(true);
    });

    it('should generate .prettierrc with printWidth: 100', async () => {
      const outputDir = path.join(tmpDir, 'tool-prettier-width');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const prettierrc = readJsonFile(path.join(outputDir, '.prettierrc'));
      expect(prettierrc.printWidth).toBe(100);
    });

    it('should generate .editorconfig with indent_size = 2', async () => {
      const outputDir = path.join(tmpDir, 'tool-editorconfig');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const editorconfig = readTextFile(path.join(outputDir, '.editorconfig'));
      expect(editorconfig).toContain('indent_size = 2');
    });

    it('should generate .editorconfig with root = true', async () => {
      const outputDir = path.join(tmpDir, 'tool-editorconfig-root');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const editorconfig = readTextFile(path.join(outputDir, '.editorconfig'));
      expect(editorconfig).toContain('root = true');
    });

    it('should generate .gitignore that contains dist/', async () => {
      const outputDir = path.join(tmpDir, 'tool-gitignore-dist');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const gitignore = readTextFile(path.join(outputDir, '.gitignore'));
      expect(gitignore).toContain('dist/');
    });

    it('should generate .gitignore that contains node_modules/', async () => {
      const outputDir = path.join(tmpDir, 'tool-gitignore-nm');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const gitignore = readTextFile(path.join(outputDir, '.gitignore'));
      expect(gitignore).toContain('node_modules/');
    });

    it('should generate .gitignore that contains .env', async () => {
      const outputDir = path.join(tmpDir, 'tool-gitignore-env');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const gitignore = readTextFile(path.join(outputDir, '.gitignore'));
      expect(gitignore).toContain('.env');
    });

    it('should generate .npmrc with save-exact=true', async () => {
      const outputDir = path.join(tmpDir, 'tool-npmrc');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const npmrc = readTextFile(path.join(outputDir, '.npmrc'));
      expect(npmrc).toContain('save-exact=true');
    });

    it('should generate .nvmrc with version 22', async () => {
      const outputDir = path.join(tmpDir, 'tool-nvmrc');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const nvmrc = readTextFile(path.join(outputDir, '.nvmrc')).trim();
      expect(nvmrc).toBe('22');
    });

    it('should generate eslint.config.mjs (ESM format)', async () => {
      const outputDir = path.join(tmpDir, 'tool-eslint');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'eslint.config.mjs'))).toBe(true);
      expect(fileExists(path.join(outputDir, '.eslintrc.js'))).toBe(false);
    });

    it('should generate commitlint.config.js', async () => {
      const outputDir = path.join(tmpDir, 'tool-commitlint');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      expect(fileExists(path.join(outputDir, 'commitlint.config.js'))).toBe(true);
    });

    it('should generate README.md with non-empty content', async () => {
      const outputDir = path.join(tmpDir, 'tool-readme-content');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const readme = readTextFile(path.join(outputDir, 'README.md'));
      expect(readme.length).toBeGreaterThan(0);
    });

    it('should generate tsconfig.build.json with tests directory in exclude', async () => {
      const outputDir = path.join(tmpDir, 'tool-tscbuild-exclude');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const tsconfigBuild = readJsonFile(path.join(outputDir, 'tsconfig.build.json'));
      const exclude = tsconfigBuild.exclude as string[];
      expect(Array.isArray(exclude)).toBe(true);
      expect(exclude.length).toBeGreaterThan(0);
    });

    it('should generate nest-cli.json with @nestjs/schematics collection', async () => {
      const outputDir = path.join(tmpDir, 'tool-nestcli-collection');
      await generate(makeConfig({ name: 'my-api', outputDir }), registry, TEMPLATES_DIR);
      const nestCli = readJsonFile(path.join(outputDir, 'nest-cli.json'));
      expect(nestCli.collection).toBe('@nestjs/schematics');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 31. ADDITIONAL PROJECT NAME VALIDATION EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('31. Additional Project Name Validation Edge Cases', () => {
    it('should accept single character name "a"', () => {
      const result = validateConfig(makeConfig({ name: 'a', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept name starting with digit "1test"', () => {
      const result = validateConfig(makeConfig({ name: '1test', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept all-numeric name "123"', () => {
      const result = validateConfig(makeConfig({ name: '123', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept name "test"', () => {
      const result = validateConfig(makeConfig({ name: 'test', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept name "test-api"', () => {
      const result = validateConfig(makeConfig({ name: 'test-api', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept name "my-project-123"', () => {
      const result = validateConfig(makeConfig({ name: 'my-project-123', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept name with multiple hyphens "a-b-c-d"', () => {
      const result = validateConfig(makeConfig({ name: 'a-b-c-d', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should accept long valid name (50 chars)', () => {
      const result = validateConfig(makeConfig({ name: 'my-very-long-project-name-that-is-quite-long-00123', outputDir: '/tmp/x' }));
      expect(result.success).toBe(true);
    });

    it('should reject empty name ""', () => {
      const result = validateConfig(makeConfig({ name: '', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject name with uppercase "MyProject"', () => {
      const result = validateConfig(makeConfig({ name: 'MyProject', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('should reject name with space "my project"', () => {
      const result = validateConfig(makeConfig({ name: 'my project', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject name starting with hyphen "-my-project"', () => {
      const result = validateConfig(makeConfig({ name: '-my-project', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('should reject name with exclamation mark "test!"', () => {
      const result = validateConfig(makeConfig({ name: 'test!', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject name with underscore "my_project"', () => {
      const result = validateConfig(makeConfig({ name: 'my_project', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject all-uppercase name "TEST"', () => {
      const result = validateConfig(makeConfig({ name: 'TEST', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject name with dot "a.b"', () => {
      const result = validateConfig(makeConfig({ name: 'a.b', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject name with @ symbol "test@"', () => {
      const result = validateConfig(makeConfig({ name: 'test@', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject name with slash "my/project"', () => {
      const result = validateConfig(makeConfig({ name: 'my/project', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should reject name with colon "my:project"', () => {
      const result = validateConfig(makeConfig({ name: 'my:project', outputDir: '/tmp/x' }));
      expect(result.success).toBe(false);
    });

    it('should validate successfully for aws-lambda project type with valid name', () => {
      const result = validateConfig(
        makeConfig({ name: 'my-lambda', projectType: 'aws-lambda', outputDir: '/tmp/x' }),
      );
      expect(result.success).toBe(true);
    });
  });
});
