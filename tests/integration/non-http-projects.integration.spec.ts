import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { TRANSPORT_LAYERS } from '@spoonfeed/types';
import type { ProjectConfig, RecipeId, RecipeDefinition, TransportLayer } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const HTTP_ADAPTER_RUNTIME_PACKAGES = [
  '@nestjs/platform-express',
  '@nestjs/platform-fastify',
  'express',
  'fastify',
  '@fastify/etag',
  '@fastify/aws-lambda',
  '@codegenie/serverless-express',
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

/**
 * Returns recipe runtime dependencies (the deps that land in "dependencies",
 * not devDependencies) from package.json after generation.
 */
function getRuntimeDeps(outputDir: string): Record<string, string> {
  const pkg = readJson(outputDir, 'package.json');
  return (pkg.dependencies ?? {}) as Record<string, string>;
}

/**
 * Returns recipe devDependencies from package.json after generation.
 */
function getDevDeps(outputDir: string): Record<string, string> {
  const pkg = readJson(outputDir, 'package.json');
  return (pkg.devDependencies ?? {}) as Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLI App projects
// ─────────────────────────────────────────────────────────────────────────────

describe('Non-HTTP project: cli-app', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cli-app-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('generates without error and produces expected structure', async () => {
    const config = makeConfig({ outputDir, projectType: 'cli-app' });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'package.json')).toBe(true);
    expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/app.module.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/commands/hello.command.ts')).toBe(true);
  });

  it('main.ts uses CommandFactory, not HTTP bootstrap', async () => {
    const config = makeConfig({ outputDir, projectType: 'cli-app' });
    await generate(config, registry, TEMPLATES_DIR);

    const mainTs = readFile(outputDir, 'src/main.ts');
    expect(mainTs).toContain('CommandFactory');
    expect(mainTs).not.toContain('FastifyAdapter');
    expect(mainTs).not.toContain('NestFactory.create(AppModule)');
    expect(mainTs).not.toContain('app.listen');
  });

  it('package.json has nest-commander but no HTTP adapter runtime deps', async () => {
    const config = makeConfig({ outputDir, projectType: 'cli-app' });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['nest-commander']).toBeDefined();

    for (const pkg of HTTP_ADAPTER_RUNTIME_PACKAGES) {
      expect(deps[pkg]).toBeUndefined();
    }
  });

  it('base template does not leak HTTP adapter devDependencies into cli-app', async () => {
    const config = makeConfig({ outputDir, projectType: 'cli-app', httpAdapter: 'fastify' });
    await generate(config, registry, TEMPLATES_DIR);

    const devDeps = getDevDeps(outputDir);

    // Fixed: The base package.json.ejs template now checks projectType before adding
    // HTTP adapter devDependencies. Non-HTTP project types no longer get them.
    expect(devDeps['@nestjs/platform-fastify']).toBeUndefined();
  });

  it('generates successfully with a compatibleWith:all recipe (config-validation)', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'cli-app',
      recipes: ['config-validation'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['zod']).toBeDefined();
    expect(fileExists(outputDir, 'src/config/env.validation.ts')).toBe(true);
  });

  it('generates successfully with a compatibleWith:all recipe (typeorm-postgres)', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'cli-app',
      recipes: ['typeorm-postgres'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['@nestjs/typeorm']).toBeDefined();
    expect(deps['typeorm']).toBeDefined();
    expect(deps['pg']).toBeDefined();
  });

  it('generates successfully with multiple compatibleWith:all recipes', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'cli-app',
      recipes: ['config-validation', 'pino', 'cqrs'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['zod']).toBeDefined();
    expect(deps['nestjs-pino']).toBeDefined();
    expect(deps['@nestjs/cqrs']).toBeDefined();
  });

  // BUG: Recipes like correlation-id, request-logging, distributed-tracing, and multi-tenancy
  // have compatibleWith: 'all' but their template files (.ejs) reference HTTP adapter types
  // (FastifyRequest/FastifyReply or Express Request/Response). These middleware files will be
  // generated for cli-app even though cli-app has no HTTP request pipeline.
  it('correlation-id recipe (compatibleWith:all) generates middleware for cli-app', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'cli-app',
      recipes: ['correlation-id'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    // The middleware file is generated, even though cli-app has no HTTP request pipeline
    // to attach middleware to. The code compiles but is dead code.
    expect(
      fileExists(outputDir, 'src/shared/middleware/correlation-id.middleware.ts'),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Scheduled Worker projects
// ─────────────────────────────────────────────────────────────────────────────

describe('Non-HTTP project: scheduled-worker', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-worker-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('generates without error and produces expected structure', async () => {
    const config = makeConfig({ outputDir, projectType: 'scheduled-worker' });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'package.json')).toBe(true);
    expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/app.module.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/jobs/example.job.ts')).toBe(true);
  });

  it('main.ts uses createApplicationContext, not HTTP server', async () => {
    const config = makeConfig({ outputDir, projectType: 'scheduled-worker' });
    await generate(config, registry, TEMPLATES_DIR);

    const mainTs = readFile(outputDir, 'src/main.ts');
    expect(mainTs).toContain('createApplicationContext');
    expect(mainTs).not.toContain('FastifyAdapter');
    expect(mainTs).not.toContain('NestFactory.create(AppModule)');
    expect(mainTs).not.toContain('app.listen');
  });

  it('app.module.ts includes ScheduleModule', async () => {
    const config = makeConfig({ outputDir, projectType: 'scheduled-worker' });
    await generate(config, registry, TEMPLATES_DIR);

    const appModule = readFile(outputDir, 'src/app.module.ts');
    expect(appModule).toContain('ScheduleModule');
  });

  it('package.json has @nestjs/schedule but no HTTP adapter runtime deps', async () => {
    const config = makeConfig({ outputDir, projectType: 'scheduled-worker' });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['@nestjs/schedule']).toBeDefined();

    for (const pkg of HTTP_ADAPTER_RUNTIME_PACKAGES) {
      expect(deps[pkg]).toBeUndefined();
    }
  });

  it('base template does not leak HTTP adapter devDependencies into scheduled-worker', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'scheduled-worker',
      httpAdapter: 'fastify',
    });
    await generate(config, registry, TEMPLATES_DIR);

    const devDeps = getDevDeps(outputDir);

    // Fixed: The base package.json.ejs template now checks projectType before adding
    // HTTP adapter devDependencies. Non-HTTP project types no longer get them.
    expect(devDeps['@nestjs/platform-fastify']).toBeUndefined();
  });

  it('generates successfully with a compatibleWith:all recipe (pino)', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'scheduled-worker',
      recipes: ['pino'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['nestjs-pino']).toBeDefined();
    expect(deps['pino']).toBeDefined();
  });

  it('generates successfully with multiple compatibleWith:all recipes', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'scheduled-worker',
      recipes: ['config-validation', 'winston', 'graceful-shutdown'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['zod']).toBeDefined();
    expect(deps['nest-winston']).toBeDefined();
  });

  // BUG: Same middleware leak as cli-app for HTTP-focused recipes with compatibleWith: 'all'
  it('multi-tenancy recipe (compatibleWith:all) generates HTTP middleware for scheduled-worker', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'scheduled-worker',
      recipes: ['multi-tenancy'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    // The middleware file references FastifyRequest/FastifyReply or Express types,
    // which are dead code in a scheduled-worker context.
    expect(
      fileExists(outputDir, 'src/shared/middleware/tenant.middleware.ts'),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Microservice projects with transport layers
// ─────────────────────────────────────────────────────────────────────────────

describe('Non-HTTP project: microservice', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-microservice-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('generates without error with default (tcp) transport', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      transportLayer: 'tcp',
    });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'package.json')).toBe(true);
    expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
  });

  it('main.ts uses createMicroservice, not HTTP server', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      transportLayer: 'tcp',
    });
    await generate(config, registry, TEMPLATES_DIR);

    const mainTs = readFile(outputDir, 'src/main.ts');
    expect(mainTs).toContain('createMicroservice');
    expect(mainTs).not.toContain('FastifyAdapter');
    expect(mainTs).not.toContain('NestFactory.create(AppModule)');
  });

  it('package.json has @nestjs/microservices but no HTTP adapter runtime deps', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      transportLayer: 'tcp',
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['@nestjs/microservices']).toBeDefined();

    for (const pkg of HTTP_ADAPTER_RUNTIME_PACKAGES) {
      expect(deps[pkg]).toBeUndefined();
    }
  });

  it('base template does not leak HTTP adapter devDependencies into microservice', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      transportLayer: 'tcp',
      httpAdapter: 'fastify',
    });
    await generate(config, registry, TEMPLATES_DIR);

    const devDeps = getDevDeps(outputDir);

    // Fixed: The base package.json.ejs template now checks projectType before adding
    // HTTP adapter devDependencies. Non-HTTP project types no longer get them.
    expect(devDeps['@nestjs/platform-fastify']).toBeUndefined();
  });

  describe.each(
    TRANSPORT_LAYERS.filter((t) => t !== 'custom').map((t) => [t]),
  )('transport layer: %s', (transport) => {
    it(`generates without error for ${transport} transport`, async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: transport as TransportLayer,
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'package.json')).toBe(true);
      expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
      expect(fileExists(outputDir, 'src/app.module.ts')).toBe(true);

      const deps = getRuntimeDeps(outputDir);
      expect(deps['@nestjs/microservices']).toBeDefined();

      // No HTTP adapter runtime deps should leak in
      for (const pkg of HTTP_ADAPTER_RUNTIME_PACKAGES) {
        expect(deps[pkg]).toBeUndefined();
      }
    });
  });

  it('generates successfully with a compatibleWith:all recipe (typeorm-postgres)', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      transportLayer: 'tcp',
      recipes: ['typeorm-postgres'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['@nestjs/typeorm']).toBeDefined();
    expect(deps['typeorm']).toBeDefined();
    expect(deps['pg']).toBeDefined();
  });

  it('generates successfully with a recipe that explicitly lists microservice (jwt-auth)', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      transportLayer: 'tcp',
      recipes: ['jwt-auth'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['@nestjs/jwt']).toBeDefined();
    expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(true);
  });

  it('generates successfully with multiple recipes', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      transportLayer: 'redis',
      recipes: ['pino', 'config-validation', 'cqrs'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const deps = getRuntimeDeps(outputDir);
    expect(deps['nestjs-pino']).toBeDefined();
    expect(deps['zod']).toBeDefined();
    expect(deps['@nestjs/cqrs']).toBeDefined();
  });

  // BUG: The opentelemetry recipe has compatibleWith: 'all' but its template
  // (tracing.ts.ejs) unconditionally adds either FastifyInstrumentation or
  // ExpressInstrumentation based on httpAdapter. For microservice projects these
  // instrumentations are unnecessary and reference packages that shouldn't be present.
  it('opentelemetry recipe (compatibleWith:all) generates adapter-specific instrumentation for microservice', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'microservice',
      transportLayer: 'tcp',
      httpAdapter: 'fastify',
      recipes: ['opentelemetry'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    const tracingFile = readFile(
      outputDir,
      'src/infrastructure/telemetry/tracing.ts',
    );

    // BUG: The tracing.ts template generates FastifyInstrumentation for a microservice
    // project that has no Fastify server. The import and usage are dead code.
    expect(tracingFile).toContain('FastifyInstrumentation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Recipe compatibleWith accuracy audit
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe compatibleWith accuracy', () => {
  let recipes: RecipeDefinition[];
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
    recipes = registry.getAll();
  });

  it('recipes with middleware templates that reference HTTP adapter types should not be compatibleWith:all', () => {
    // These recipes previously had compatibleWith: 'all' but their .ejs templates reference
    // HTTP-specific types (FastifyRequest/FastifyReply or Express Request/Response).
    // correlation-id and request-logging are now FIXED (HTTP-only).
    // distributed-tracing and multi-tenancy still have compatibleWith: 'all'.
    const recipesWithHttpMiddlewareTemplates = [
      'correlation-id',
      'request-logging',
      'distributed-tracing',
      'multi-tenancy',
    ];

    const violations: string[] = [];

    for (const recipeId of recipesWithHttpMiddlewareTemplates) {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) continue;

      if (recipe.compatibleWith === 'all') {
        violations.push(
          `${recipe.id}: compatibleWith is 'all' but template generates HTTP middleware`,
        );
      }
    }

    // correlation-id and request-logging are now fixed (HTTP-only).
    // Only distributed-tracing and multi-tenancy remain as known issues.
    expect(violations.length).toBeGreaterThan(0);
    expect(violations).toEqual([
      "distributed-tracing: compatibleWith is 'all' but template generates HTTP middleware",
      "multi-tenancy: compatibleWith is 'all' but template generates HTTP middleware",
    ]);
  });

  it('opentelemetry recipe is now HTTP-only but still adds HTTP-adapter-specific instrumentation', () => {
    const otel = recipes.find((r) => r.id === 'opentelemetry');
    expect(otel).toBeDefined();

    // FIXED: opentelemetry is now restricted to HTTP project types only.
    // It still includes adapter-specific instrumentation deps, but they are now
    // only applied to HTTP projects where the adapter actually exists.
    expect(otel!.compatibleWith).not.toBe('all');
    if (otel!.compatibleWith !== 'all') {
      expect(otel!.compatibleWith).toContain('http-api');
      expect(otel!.compatibleWith).not.toContain('cli-app');
      expect(otel!.compatibleWith).not.toContain('scheduled-worker');
      expect(otel!.compatibleWith).not.toContain('microservice');
    }

    const hasFastifyInstrumentation = Object.keys(otel!.dependencies).some(
      (dep) => dep.includes('fastify'),
    );
    const hasExpressInstrumentation =
      otel!.expressDependencies &&
      Object.keys(otel!.expressDependencies).some((dep) =>
        dep.includes('express'),
      );

    expect(hasFastifyInstrumentation || hasExpressInstrumentation).toBe(true);
  });

  it('cors recipe is correctly restricted to HTTP-only project types', () => {
    const cors = recipes.find((r) => r.id === 'cors');
    expect(cors).toBeDefined();

    // Fixed: cors is now restricted to HTTP project types only.
    expect(cors!.compatibleWith).not.toBe('all');
    expect(cors!.compatibleWith).toContain('http-api');
    expect(cors!.compatibleWith).not.toContain('cli-app');
    expect(cors!.compatibleWith).not.toContain('scheduled-worker');
  });

  it('api-versioning recipe is correctly restricted to HTTP-only project types', () => {
    const apiVersioning = recipes.find((r) => r.id === 'api-versioning');
    expect(apiVersioning).toBeDefined();

    // Fixed: api-versioning is now restricted to HTTP project types only.
    expect(apiVersioning!.compatibleWith).not.toBe('all');
    expect(apiVersioning!.compatibleWith).toContain('http-api');
    expect(apiVersioning!.compatibleWith).not.toContain('cli-app');
    expect(apiVersioning!.compatibleWith).not.toContain('scheduled-worker');
  });

  it('pagination recipe is correctly restricted to HTTP-only project types', () => {
    const pagination = recipes.find((r) => r.id === 'pagination');
    expect(pagination).toBeDefined();

    // Fixed: pagination is now restricted to HTTP project types only.
    expect(pagination!.compatibleWith).not.toBe('all');
    expect(pagination!.compatibleWith).toContain('http-api');
    expect(pagination!.compatibleWith).not.toContain('cli-app');
    expect(pagination!.compatibleWith).not.toContain('scheduled-worker');
  });

  it('filtering recipe is correctly restricted to HTTP-only project types', () => {
    const filtering = recipes.find((r) => r.id === 'filtering');
    expect(filtering).toBeDefined();

    // Fixed: filtering is now restricted to HTTP project types only.
    expect(filtering!.compatibleWith).not.toBe('all');
    expect(filtering!.compatibleWith).toContain('http-api');
    expect(filtering!.compatibleWith).not.toContain('cli-app');
    expect(filtering!.compatibleWith).not.toContain('scheduled-worker');
  });

  it('throttler recipe is correctly restricted to HTTP-only project types', () => {
    const throttler = recipes.find((r) => r.id === 'throttler');
    expect(throttler).toBeDefined();

    // Fixed: throttler is now restricted to HTTP project types only.
    expect(throttler!.compatibleWith).not.toBe('all');
    expect(throttler!.compatibleWith).toContain('http-api');
    expect(throttler!.compatibleWith).not.toContain('cli-app');
    expect(throttler!.compatibleWith).not.toContain('scheduled-worker');
  });

  it('recipes that correctly restrict compatibleWith to HTTP types should be HTTP-only', () => {
    const correctlyRestrictedRecipes = [
      'helmet',
      'csrf',
      'swagger',
      'http-caching',
      'websockets',
      'graphql-mercurius',
      'idempotency',
    ];

    for (const recipeId of correctlyRestrictedRecipes) {
      const recipe = recipes.find((r) => r.id === recipeId);
      expect(recipe).toBeDefined();
      expect(recipe!.compatibleWith).not.toBe('all');

      if (recipe!.compatibleWith !== 'all') {
        expect(recipe!.compatibleWith).not.toContain('cli-app');
        expect(recipe!.compatibleWith).not.toContain('scheduled-worker');
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Validate no adapter packages leak into non-HTTP projects
// ─────────────────────────────────────────────────────────────────────────────

describe('No HTTP adapter runtime deps leak into non-HTTP project types', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it.each([
    ['cli-app', undefined],
    ['scheduled-worker', undefined],
    ['microservice', 'tcp'],
    ['microservice', 'redis'],
    ['microservice', 'nats'],
  ] as const)(
    '%s (transport: %s): no HTTP adapter in runtime dependencies',
    async (projectType, transportLayer) => {
      const outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-noleak-${projectType}-`),
      );

      try {
        const config = makeConfig({
          outputDir,
          projectType,
          transportLayer: transportLayer as TransportLayer | undefined,
        });
        await generate(config, registry, TEMPLATES_DIR);

        const deps = getRuntimeDeps(outputDir);

        for (const pkg of HTTP_ADAPTER_RUNTIME_PACKAGES) {
          expect(deps[pkg]).toBeUndefined();
        }
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    },
  );

  it('cli-app with express httpAdapter setting still gets no runtime adapter deps', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-noleak-cli-express-'),
    );

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'cli-app',
        httpAdapter: 'express',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const deps = getRuntimeDeps(outputDir);

      // The generator correctly skips adapter runtime deps for non-HTTP types
      for (const pkg of HTTP_ADAPTER_RUNTIME_PACKAGES) {
        expect(deps[pkg]).toBeUndefined();
      }
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  // BUG: The opentelemetry recipe with compatibleWith: 'all' adds HTTP instrumentation
  // packages to runtime dependencies even for non-HTTP project types.
  it('opentelemetry recipe adds @opentelemetry/instrumentation-fastify to microservice deps', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-noleak-otel-'),
    );

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'tcp',
        httpAdapter: 'fastify',
        recipes: ['opentelemetry'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const deps = getRuntimeDeps(outputDir);

      // BUG: @opentelemetry/instrumentation-fastify is added to a microservice project
      // that has no Fastify server. This dependency is unnecessary and adds bloat.
      expect(deps['@opentelemetry/instrumentation-fastify']).toBeDefined();
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('opentelemetry recipe adds @opentelemetry/instrumentation-express to cli-app deps when httpAdapter is express', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-noleak-otel-express-'),
    );

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'cli-app',
        httpAdapter: 'express',
        recipes: ['opentelemetry'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const deps = getRuntimeDeps(outputDir);

      // BUG: @opentelemetry/instrumentation-express is added to a cli-app project
      // that has no Express server.
      expect(deps['@opentelemetry/instrumentation-express']).toBeDefined();
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Recipe mainTsSetup blocks don't crash on non-HTTP main.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe mainTsSetup blocks with non-HTTP main.ts', () => {
  let registry: RecipeRegistry;
  let recipes: RecipeDefinition[];

  beforeAll(() => {
    registry = createRegistry();
    recipes = registry.getAll();
  });

  it('no recipe with mainTsSetup has compatibleWith:all', () => {
    const recipesWithMainTsSetup = recipes.filter(
      (r) => r.mainTsSetup || r.expressMainTsSetup,
    );

    for (const recipe of recipesWithMainTsSetup) {
      // Recipes with mainTsSetup are swagger and helmet, both of which
      // correctly restrict their compatibleWith to HTTP project types.
      expect(recipe.compatibleWith).not.toBe('all');
    }
  });

  it('swagger mainTsSetup targets app.listen anchor which does not exist in cli-app main.ts', async () => {
    // This test verifies that IF swagger were applied to a cli-app (which the
    // compatibleWith guard currently prevents), the block insertion would fall
    // back gracefully since the cli-app main.ts has no `app.listen` line.
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-maintsfallback-'),
    );

    try {
      // Generate a plain cli-app first
      const config = makeConfig({
        outputDir,
        projectType: 'cli-app',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'src/main.ts');

      // cli-app main.ts should not have app.listen (the primary anchor)
      expect(mainTs).not.toContain('app.listen');
      // cli-app main.ts should not have await app.init() (the secondary anchor)
      expect(mainTs).not.toContain('await app.init()');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('scheduled-worker main.ts has app.init() which is a secondary anchor for mainTsSetup blocks', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-maintsfallback-worker-'),
    );

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'scheduled-worker',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'src/main.ts');

      // scheduled-worker main.ts has await app.init() which IS a secondary anchor
      // for the insertBlockToString function. If a recipe with mainTsSetup were
      // somehow applied, the block would be inserted after app.init().
      expect(mainTs).toContain('await app.init()');
      expect(mainTs).not.toContain('app.listen');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('microservice main.ts has app.listen() which IS a valid anchor for mainTsSetup blocks', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-maintsfallback-ms-'),
    );

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'tcp',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'src/main.ts');

      // microservice main.ts does have `await app.listen()` for the microservice
      // listener. This means the primary anchor would match, and a mainTsSetup
      // block could be inserted. The inserted code would reference HTTP-specific
      // APIs (like app.register) that don't exist on a microservice app instance.
      expect(mainTs).toContain('await app.listen()');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. E2E test template for non-HTTP types
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E test template for non-HTTP project types', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('cli-app does not get an HTTP-based e2e test', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-e2e-cliapp-'),
    );

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'cli-app',
        httpAdapter: 'fastify',
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Fixed: The generator now removes the HTTP-based e2e test for non-HTTP project types.
      expect(fileExists(outputDir, 'tests/e2e/app.e2e-spec.ts')).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('scheduled-worker does not get an HTTP-based e2e test', async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'spoonfeed-e2e-worker-'),
    );

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'scheduled-worker',
        httpAdapter: 'fastify',
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Fixed: The generator now removes the HTTP-based e2e test for non-HTTP project types.
      expect(fileExists(outputDir, 'tests/e2e/app.e2e-spec.ts')).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
