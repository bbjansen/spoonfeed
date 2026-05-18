import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, RecipeId } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const SHARED_RECIPES: RecipeId[] = [
  'swagger',
  'pino',
  'jwt-auth',
  'helmet',
  'cors',
  'health-checks',
  'correlation-id',
  'pagination',
  'sentry',
  'opentelemetry',
];

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
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

/**
 * Recursively collect all file paths under `dir`, relative to `base`.
 * Skips node_modules.
 */
function collectFiles(dir: string, base: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, base));
    } else {
      results.push(path.relative(base, fullPath));
    }
  }
  return results.sort();
}

describe('Adapter diff: Express vs Fastify with identical recipes', () => {
  let expressDir: string;
  let fastifyDir: string;
  let registry: RecipeRegistry;
  let expressFiles: string[];
  let fastifyFiles: string[];

  beforeAll(async () => {
    registry = createRegistry();

    expressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-express-'));
    fastifyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-fastify-'));

    const expressConfig = makeConfig({
      outputDir: expressDir,
      projectType: 'http-api',
      httpAdapter: 'express',
      recipes: [...SHARED_RECIPES],
    });

    const fastifyConfig = makeConfig({
      outputDir: fastifyDir,
      projectType: 'http-api',
      httpAdapter: 'fastify',
      recipes: [...SHARED_RECIPES],
    });

    await generate(expressConfig, registry, TEMPLATES_DIR);
    await generate(fastifyConfig, registry, TEMPLATES_DIR);

    expressFiles = collectFiles(expressDir, expressDir);
    fastifyFiles = collectFiles(fastifyDir, fastifyDir);
  });

  afterAll(() => {
    fs.rmSync(expressDir, { recursive: true, force: true });
    fs.rmSync(fastifyDir, { recursive: true, force: true });
  });

  // ── 1. Both projects have the same set of files ───────────────────

  it('should produce the same set of files in both projects', () => {
    expect(expressFiles).toEqual(fastifyFiles);
  });

  // ── 2. Files that MUST differ between adapters ────────────────────

  describe('files that must differ between adapters', () => {
    it('src/main.ts: Express uses NestFactory.create(AppModule), Fastify uses FastifyAdapter', () => {
      const expressMain = readFile(expressDir, 'src/main.ts');
      const fastifyMain = readFile(fastifyDir, 'src/main.ts');

      expect(expressMain).not.toEqual(fastifyMain);

      expect(expressMain).toContain('NestFactory.create(AppModule)');
      expect(expressMain).not.toContain('FastifyAdapter');

      expect(fastifyMain).toContain('FastifyAdapter');
      expect(fastifyMain).not.toContain('NestFactory.create(AppModule)');
    });

    it('http-exception.filter.ts: Express imports from express, Fastify from fastify', () => {
      const expressFilter = readFile(expressDir, 'src/shared/filters/http-exception.filter.ts');
      const fastifyFilter = readFile(fastifyDir, 'src/shared/filters/http-exception.filter.ts');

      expect(expressFilter).not.toEqual(fastifyFilter);

      expect(expressFilter).toContain("from 'express'");
      expect(expressFilter).not.toContain('FastifyReply');
      expect(expressFilter).not.toContain('FastifyRequest');

      expect(fastifyFilter).toContain("from 'fastify'");
      expect(fastifyFilter).toContain('FastifyReply');
      expect(fastifyFilter).toContain('FastifyRequest');
    });

    it('request-timeout.middleware.ts: Express imports from express, Fastify from fastify', () => {
      const expressMw = readFile(
        expressDir,
        'src/shared/middleware/request-timeout.middleware.ts',
      );
      const fastifyMw = readFile(
        fastifyDir,
        'src/shared/middleware/request-timeout.middleware.ts',
      );

      expect(expressMw).not.toEqual(fastifyMw);

      expect(expressMw).toContain("from 'express'");
      expect(expressMw).toContain('req: Request, res: Response, next: NextFunction');
      expect(expressMw).not.toContain('FastifyRequest');

      expect(fastifyMw).toContain("from 'fastify'");
      expect(fastifyMw).toContain('FastifyRequest');
    });

    it('correlation-id.middleware.ts: Express imports from express, Fastify from fastify', () => {
      const expressMw = readFile(
        expressDir,
        'src/shared/middleware/correlation-id.middleware.ts',
      );
      const fastifyMw = readFile(
        fastifyDir,
        'src/shared/middleware/correlation-id.middleware.ts',
      );

      expect(expressMw).not.toEqual(fastifyMw);

      expect(expressMw).toContain("from 'express'");
      expect(expressMw).toContain('req: Request, res: Response, next: NextFunction');
      expect(expressMw).not.toContain('FastifyRequest');

      expect(fastifyMw).toContain("from 'fastify'");
      expect(fastifyMw).toContain("FastifyRequest['raw']");
    });

    it('app.e2e-spec.ts: Express uses INestApplication, Fastify uses NestFastifyApplication', () => {
      const expressE2e = readFile(expressDir, 'tests/e2e/app.e2e-spec.ts');
      const fastifyE2e = readFile(fastifyDir, 'tests/e2e/app.e2e-spec.ts');

      expect(expressE2e).not.toEqual(fastifyE2e);

      expect(expressE2e).toContain('INestApplication');
      expect(expressE2e).toContain('moduleFixture.createNestApplication()');
      expect(expressE2e).not.toContain('NestFastifyApplication');
      expect(expressE2e).not.toContain('FastifyAdapter');

      expect(fastifyE2e).toContain('NestFastifyApplication');
      expect(fastifyE2e).toContain('FastifyAdapter');
      expect(fastifyE2e).not.toContain('moduleFixture.createNestApplication()');
    });

    it('tracing.ts: Express uses ExpressInstrumentation, Fastify uses FastifyInstrumentation', () => {
      const expressTracing = readFile(
        expressDir,
        'src/infrastructure/telemetry/tracing.ts',
      );
      const fastifyTracing = readFile(
        fastifyDir,
        'src/infrastructure/telemetry/tracing.ts',
      );

      expect(expressTracing).not.toEqual(fastifyTracing);

      expect(expressTracing).toContain('ExpressInstrumentation');
      expect(expressTracing).not.toContain('FastifyInstrumentation');

      expect(fastifyTracing).toContain('FastifyInstrumentation');
      expect(fastifyTracing).not.toContain('ExpressInstrumentation');
    });
  });

  // ── 3. Files that SHOULD be identical ─────────────────────────────

  describe('files that should be identical between adapters', () => {
    const identicalFiles = [
      'src/app.module.ts',
      'tsconfig.json',
      'tsconfig.build.json',
      '.gitignore',
      '.prettierrc',
      'jest.config.ts',
      '.env.example',
      'src/shared/errors/application.error.ts',
    ];

    it.each(identicalFiles)('%s should be identical in both projects', (filePath) => {
      const expressContent = readFile(expressDir, filePath);
      const fastifyContent = readFile(fastifyDir, filePath);
      expect(expressContent).toEqual(fastifyContent);
    });

    it('.spoonfeed.json should be identical (ignoring generatedAt timestamps)', () => {
      const expressManifest = readJson(expressDir, '.spoonfeed.json');
      const fastifyManifest = readJson(fastifyDir, '.spoonfeed.json');

      // Strip fields that intentionally differ
      delete expressManifest.generatedAt;
      delete fastifyManifest.generatedAt;
      delete expressManifest.httpAdapter;
      delete fastifyManifest.httpAdapter;

      // Strip per-recipe installedAt timestamps
      const expressRecipes = expressManifest.recipes as
        | Record<string, Record<string, unknown>>
        | undefined;
      const fastifyRecipes = fastifyManifest.recipes as
        | Record<string, Record<string, unknown>>
        | undefined;

      if (expressRecipes) {
        for (const recipe of Object.values(expressRecipes)) {
          delete recipe.installedAt;
        }
      }
      if (fastifyRecipes) {
        for (const recipe of Object.values(fastifyRecipes)) {
          delete recipe.installedAt;
        }
      }

      expect(expressManifest).toEqual(fastifyManifest);
    });
  });

  // ── 4. package.json adapter dependencies ──────────────────────────

  describe('package.json adapter dependencies', () => {
    it('Express project has @nestjs/platform-express, not @nestjs/platform-fastify', () => {
      const pkg = readJson(expressDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['@nestjs/platform-express']).toBeDefined();
      expect(deps['@nestjs/platform-fastify']).toBeUndefined();
    });

    it('Fastify project has @nestjs/platform-fastify, not @nestjs/platform-express', () => {
      const pkg = readJson(fastifyDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['@nestjs/platform-fastify']).toBeDefined();
      expect(deps['@nestjs/platform-express']).toBeUndefined();
    });

    it('shared dependencies have the same version in both projects', () => {
      const expressPkg = readJson(expressDir, 'package.json');
      const fastifyPkg = readJson(fastifyDir, 'package.json');

      const expressDeps = expressPkg.dependencies as Record<string, string>;
      const fastifyDeps = fastifyPkg.dependencies as Record<string, string>;

      const sharedDepNames = [
        '@nestjs/common',
        '@nestjs/core',
        '@nestjs/config',
        'reflect-metadata',
      ];

      for (const dep of sharedDepNames) {
        expect(expressDeps[dep]).toBeDefined();
        expect(fastifyDeps[dep]).toBeDefined();
        expect(expressDeps[dep]).toEqual(fastifyDeps[dep]);
      }
    });
  });
});
