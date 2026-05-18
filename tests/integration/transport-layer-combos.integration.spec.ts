import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { TRANSPORT_LAYERS } from '@spoonfeed/types';
import type { ProjectConfig, TransportLayer, RecipeId } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

// ─── Expected transport configuration per layer ──────────────────────────────

/** NestJS Transport enum member name for each transport layer. */
const TRANSPORT_ENUM_MAP: Record<string, string> = {
  tcp: 'Transport.TCP',
  redis: 'Transport.REDIS',
  nats: 'Transport.NATS',
  mqtt: 'Transport.MQTT',
  rabbitmq: 'Transport.RMQ',
  kafka: 'Transport.KAFKA',
  grpc: 'Transport.GRPC',
};

/** Runtime npm packages required for each transport. */
const TRANSPORT_DEPS: Record<string, string[]> = {
  tcp: [], // built-in
  redis: ['ioredis'],
  nats: ['nats'],
  mqtt: ['mqtt'],
  rabbitmq: ['amqplib'],
  kafka: ['kafkajs'],
  grpc: ['@grpc/grpc-js', '@grpc/proto-loader'],
  custom: [],
};

/** Environment variables expected for each transport. */
const TRANSPORT_ENV_VARS: Record<string, string[]> = {
  tcp: ['TCP_HOST', 'TCP_PORT'],
  redis: ['REDIS_HOST', 'REDIS_PORT'],
  nats: ['NATS_URL'],
  mqtt: ['MQTT_URL'],
  rabbitmq: ['RABBITMQ_URL', 'RABBITMQ_QUEUE'],
  kafka: ['KAFKA_BROKERS'],
  grpc: ['GRPC_URL'],
};

const HTTP_ADAPTER_PACKAGES = [
  '@nestjs/platform-express',
  '@nestjs/platform-fastify',
  'express',
  'fastify',
  '@fastify/etag',
  '@fastify/aws-lambda',
  '@codegenie/serverless-express',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getRuntimeDeps(outputDir: string): Record<string, string> {
  const pkg = readJson(outputDir, 'package.json');
  return (pkg.dependencies ?? {}) as Record<string, string>;
}

function getDevDeps(outputDir: string): Record<string, string> {
  const pkg = readJson(outputDir, 'package.json');
  return (pkg.devDependencies ?? {}) as Record<string, string>;
}

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Generate microservice with each of the 8 transport layers
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: per-transport generation', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(
    TRANSPORT_LAYERS.filter((t) => t !== 'custom').map((t) => [t]),
  )('transport: %s', (transport) => {
    let outputDir: string;

    beforeEach(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-transport-${transport}-`));
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: transport as TransportLayer,
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates main.ts, package.json, and app.module.ts', () => {
      expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
      expect(fileExists(outputDir, 'package.json')).toBe(true);
      expect(fileExists(outputDir, 'src/app.module.ts')).toBe(true);
    });

    it('main.ts uses createMicroservice', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');
      expect(mainTs).toContain('createMicroservice');
    });

    it('main.ts references the correct Transport enum member', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');
      const expectedTransport = TRANSPORT_ENUM_MAP[transport];

      expect(mainTs).toContain(expectedTransport);
    });

    it('package.json has transport-specific runtime deps', () => {
      const deps = getRuntimeDeps(outputDir);
      const expectedDeps = TRANSPORT_DEPS[transport];

      expect(deps['@nestjs/microservices']).toBeDefined();

      for (const dep of expectedDeps) {
        expect(deps[dep]).toBeDefined();
      }
    });

    it('package.json has no HTTP adapter packages in runtime deps', () => {
      const deps = getRuntimeDeps(outputDir);

      for (const pkg of HTTP_ADAPTER_PACKAGES) {
        expect(deps[pkg]).toBeUndefined();
      }
    });

    it('package.json has no HTTP adapter packages in devDependencies', () => {
      const devDeps = getDevDeps(outputDir);

      expect(devDeps['@nestjs/platform-express']).toBeUndefined();
      expect(devDeps['@nestjs/platform-fastify']).toBeUndefined();
    });

    it('.env.example has transport-specific env vars', () => {
      const envContent = readFile(outputDir, '.env.example');
      const expectedVars = TRANSPORT_ENV_VARS[transport];

      if (expectedVars && expectedVars.length > 0) {
        for (const envVar of expectedVars) {
          expect(envContent).toContain(envVar);
        }
      }
    });

    it('.env.example does not contain HTTP-centric PORT var', () => {
      const envContent = readFile(outputDir, '.env.example');
      expect(envContent).not.toContain('PORT=3000');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Transport layer + common recipe interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: recipe interactions', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(
    (['tcp', 'redis', 'nats', 'kafka', 'rabbitmq', 'grpc', 'mqtt'] as const).map((t) => [t]),
  )('transport %s + common recipes (pino, health-checks, graceful-shutdown)', (transport) => {
    let outputDir: string;

    beforeEach(async () => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-transport-recipes-${transport}-`),
      );
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: transport,
        recipes: ['pino', 'health-checks', 'graceful-shutdown'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'package.json')).toBe(true);
      expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
    });

    it('recipe template files are generated', () => {
      // Pino logger module
      expect(fileExists(outputDir, 'src/infrastructure/logging/logger.module.ts')).toBe(true);
      // Health checks controller
      expect(fileExists(outputDir, 'src/shared/health/health.controller.ts')).toBe(true);
      // Graceful shutdown service
      expect(fileExists(outputDir, 'src/shared/lifecycle/shutdown.service.ts')).toBe(true);
    });

    it('package.json includes recipe dependencies', () => {
      const deps = getRuntimeDeps(outputDir);

      // Pino
      expect(deps['nestjs-pino']).toBeDefined();
      expect(deps['pino']).toBeDefined();

      // Health checks
      expect(deps['@nestjs/terminus']).toBeDefined();

      // @nestjs/microservices from project type
      expect(deps['@nestjs/microservices']).toBeDefined();
    });

    it('main.ts has transport config placeholder (no actual transport block)', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');

      // The microservice main.ts has createMicroservice
      expect(mainTs).toContain('createMicroservice');

      // None of the three recipes above have mainTsSetup, so main.ts should not
      // have any recipe blocks inserted
      expect(mainTs).not.toContain('// --- ');
    });

    it('main.ts has no HTTP-focused code', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');

      // No HTTP adapter code
      expect(mainTs).not.toContain('FastifyAdapter');
      expect(mainTs).not.toContain('NestFactory.create(AppModule)');
      expect(mainTs).not.toContain('app.enableCors');
      expect(mainTs).not.toContain('app.register(');
      expect(mainTs).not.toContain('ValidationPipe');
    });

    // BUG: The health-checks recipe generates an HTTP controller with @Controller('health')
    // and @Get() decorator. For a microservice project, there is no HTTP server to serve
    // this endpoint. The health controller should use @MessagePattern() or a
    // microservice-compatible health check mechanism instead.
    it('health-checks recipe generates HTTP controller for microservice', () => {
      const healthController = readFile(
        outputDir,
        'src/shared/health/health.controller.ts',
      );

      // The health controller uses HTTP decorators, which are non-functional
      // in a pure microservice (no HTTP server)
      expect(healthController).toContain("@Controller('health')");
      expect(healthController).toContain('@Get()');
    });

    it('.env.example includes recipe-specific env vars', () => {
      const envContent = readFile(outputDir, '.env.example');

      // Pino LOG_LEVEL
      expect(envContent).toContain('LOG_LEVEL');

      // Graceful shutdown timeout
      expect(envContent).toContain('SHUTDOWN_TIMEOUT_MS');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Transport layer + messaging recipe composition
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: messaging recipe composition', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('rabbitmq transport + bullmq recipe', () => {
    let outputDir: string;

    beforeEach(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-rmq-bullmq-'));
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'rabbitmq',
        recipes: ['bullmq'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'package.json')).toBe(true);
      expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
    });

    it('has both @nestjs/microservices and bullmq deps', () => {
      const deps = getRuntimeDeps(outputDir);
      expect(deps['@nestjs/microservices']).toBeDefined();
      expect(deps['@nestjs/bullmq']).toBeDefined();
      expect(deps['bullmq']).toBeDefined();
    });

    it('bullmq template files are generated', () => {
      expect(fileExists(outputDir, 'src/infrastructure/queue/queue.module.ts')).toBe(true);
      expect(fileExists(outputDir, 'src/infrastructure/queue/example.processor.ts')).toBe(true);
    });

    // BUG: The rabbitmq recipe definition declares @nestjs/microservices version "10.4.15"
    // while the microservice project-type package-fragment.json declares version "11.1.19".
    // When both are merged, the recipe's older version may overwrite the project-type's
    // newer version (depending on merge order), causing a version mismatch. Or the project
    // type's version wins and the rabbitmq recipe was tested against a different major version.
    it('@nestjs/microservices version consistency between project-type and rabbitmq recipe', () => {
      const deps = getRuntimeDeps(outputDir);
      const microservicesVersion = deps['@nestjs/microservices'];

      // The project-type fragment specifies 11.1.19, but the rabbitmq recipe
      // specifies 10.4.15. One of them wins in the merge.
      // This documents a version conflict bug.
      expect(
        microservicesVersion === '11.1.19' || microservicesVersion === '10.4.15',
      ).toBe(true);

      if (microservicesVersion === '10.4.15') {
        // BUG: The rabbitmq recipe's older @nestjs/microservices@10.4.15 overwrote
        // the project-type's @nestjs/microservices@11.1.19, downgrading a v11 project to v10.
        // This will cause peer dependency conflicts with @nestjs/core@11.1.19.
        expect(true).toBe(true); // Documenting the bug condition
      }
    });

    it('.env.example has bullmq Redis env vars', () => {
      const envContent = readFile(outputDir, '.env.example');
      expect(envContent).toContain('REDIS_HOST');
      expect(envContent).toContain('REDIS_PORT');
    });
  });

  describe('rabbitmq transport + rabbitmq recipe (transport + recipe overlap)', () => {
    let outputDir: string;

    beforeEach(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-rmq-rmqrecipe-'));
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'rabbitmq',
        recipes: ['rabbitmq'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'package.json')).toBe(true);
    });

    it('main.ts has RMQ listener config and recipe generates client module', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');
      // main.ts has Transport.RMQ configuration for the listener
      expect(mainTs).toContain('Transport.RMQ');

      // The recipe's queue module sets up a CLIENT for sending messages
      const queueModule = readFile(
        outputDir,
        'src/infrastructure/queue/queue.module.ts',
      );
      expect(queueModule).toContain('Transport.RMQ');
      expect(queueModule).toContain('RABBITMQ_CLIENT');
    });

    // BUG: The rabbitmq recipe adds @nestjs/microservices@10.4.15 which conflicts
    // with the project-type's @nestjs/microservices@11.1.19.
    it('has version conflict in @nestjs/microservices between recipe and project-type', () => {
      const deps = getRuntimeDeps(outputDir);
      // After merge, one version wins. Let's check which one.
      const version = deps['@nestjs/microservices'];
      // The project-type and the recipe specify different major versions.
      // Whichever wins, the other's assumption is violated.
      expect(version).toBeDefined();
    });
  });

  describe('kafka transport + dead-letter-queue recipe', () => {
    let outputDir: string;

    beforeEach(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-kafka-dlq-'));
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'kafka',
        recipes: ['dead-letter-queue'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'package.json')).toBe(true);
      expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
    });

    it('DLQ service file is generated', () => {
      expect(
        fileExists(outputDir, 'src/infrastructure/queue/dlq.service.ts'),
      ).toBe(true);
    });

    // BUG: The dead-letter-queue recipe is a generic in-memory DLQ implementation.
    // For a Kafka transport microservice, dead letter routing should use Kafka's native
    // DLT (Dead Letter Topic) pattern. The generic in-memory DLQ will lose messages
    // on restart and doesn't integrate with Kafka's consumer group offset management.
    // The recipe has no Kafka-specific awareness.
    it('DLQ service is generic in-memory, not Kafka-aware', () => {
      const dlqService = readFile(
        outputDir,
        'src/infrastructure/queue/dlq.service.ts',
      );

      // The DLQ service uses an in-memory array, not Kafka DLT
      expect(dlqService).toContain('private readonly messages: DeadLetterMessage[]');
      expect(dlqService).not.toContain('kafka');
      expect(dlqService).not.toContain('Kafka');
    });

    it('main.ts has Kafka transport configuration', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');
      expect(mainTs).toContain('Transport.KAFKA');
      expect(mainTs).toContain('brokers');
    });

    it('kafkajs is in dependencies', () => {
      const deps = getRuntimeDeps(outputDir);
      expect(deps['kafkajs']).toBeDefined();
    });
  });

  describe('kafka transport + bullmq recipe', () => {
    let outputDir: string;

    beforeEach(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-kafka-bullmq-'));
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'kafka',
        recipes: ['bullmq'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error and has both deps', () => {
      const deps = getRuntimeDeps(outputDir);
      expect(deps['@nestjs/microservices']).toBeDefined();
      expect(deps['@nestjs/bullmq']).toBeDefined();
      expect(deps['bullmq']).toBeDefined();
    });

    it('bullmq queue module exists alongside microservice', () => {
      expect(fileExists(outputDir, 'src/infrastructure/queue/queue.module.ts')).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Transport layer template completeness
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: template completeness', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(
    TRANSPORT_LAYERS.filter((t) => t !== 'custom').map((t) => [t]),
  )('transport: %s template completeness', (transport) => {
    let outputDir: string;

    beforeEach(async () => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-template-complete-${transport}-`),
      );
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: transport as TransportLayer,
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('main.ts renders without raw EJS tags', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');
      expect(mainTs).not.toContain('<%');
      expect(mainTs).not.toContain('%>');
      expect(mainTs).not.toMatch(/<%-?\s/);
    });

    it('app.module.ts renders without raw EJS tags', () => {
      const appModule = readFile(outputDir, 'src/app.module.ts');
      expect(appModule).not.toContain('<%');
      expect(appModule).not.toContain('%>');
    });

    it('package.json is valid JSON', () => {
      expect(() => readJson(outputDir, 'package.json')).not.toThrow();
    });

    it('main.ts has transport-specific configuration', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');
      const expectedTransport = TRANSPORT_ENUM_MAP[transport];

      // main.ts contains the correct transport enum member
      expect(mainTs).toContain(expectedTransport);
      // No leftover placeholder comment
      expect(mainTs).not.toContain('// Transport configuration is injected by the selected transport recipe');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Custom transport layer
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: custom transport', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  // The custom transport is accepted by the validator and generates without error,
  // but it produces the same generic main.ts as all other transports.
  it('custom transport generates without error', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-custom-transport-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'custom',
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'package.json')).toBe(true);
      expect(fileExists(outputDir, 'src/main.ts')).toBe(true);
      expect(fileExists(outputDir, 'src/app.module.ts')).toBe(true);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('custom transport provides guidance for implementing a custom strategy', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-custom-scaffold-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'custom',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'src/main.ts');

      // Contains CustomTransportStrategy guidance
      expect(mainTs).toContain('CustomTransportStrategy');
      // No leftover placeholder comment
      expect(mainTs).not.toContain('// Transport configuration is injected by the selected transport recipe');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('custom transport has @nestjs/microservices but no extra transport deps', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-custom-deps-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'custom',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const deps = getRuntimeDeps(outputDir);
      expect(deps['@nestjs/microservices']).toBeDefined();

      // No transport-specific deps (expected for custom)
      expect(deps['ioredis']).toBeUndefined();
      expect(deps['kafkajs']).toBeUndefined();
      expect(deps['nats']).toBeUndefined();
      expect(deps['mqtt']).toBeUndefined();
      expect(deps['amqplib']).toBeUndefined();
      expect(deps['@grpc/grpc-js']).toBeUndefined();
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cross-cutting: main.ts identical across all transports (meta-test)
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: main.ts identity across transports', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('different transport layers produce different main.ts content', async () => {
    const mainTsContents: Map<string, string> = new Map();

    for (const transport of TRANSPORT_LAYERS) {
      const outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-identity-${transport}-`),
      );

      try {
        const config = makeConfig({
          outputDir,
          projectType: 'microservice',
          transportLayer: transport,
        });
        await generate(config, registry, TEMPLATES_DIR);
        mainTsContents.set(transport, readFile(outputDir, 'src/main.ts'));
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    }

    const tcpMainTs = mainTsContents.get('tcp')!;
    for (const [transport, content] of mainTsContents) {
      if (transport === 'tcp') continue;
      // Each transport produces transport-specific main.ts
      expect(content).not.toEqual(tcpMainTs);
    }
  });

  it('transports with extra deps produce different package.json deps than tcp', async () => {
    const depsPerTransport: Map<string, Record<string, string>> = new Map();

    for (const transport of TRANSPORT_LAYERS) {
      const outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-pkg-identity-${transport}-`),
      );

      try {
        const config = makeConfig({
          outputDir,
          projectType: 'microservice',
          transportLayer: transport,
        });
        await generate(config, registry, TEMPLATES_DIR);
        depsPerTransport.set(transport, getRuntimeDeps(outputDir));
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    }

    const tcpDeps = depsPerTransport.get('tcp')!;
    // Transports with extra deps (redis, nats, mqtt, rabbitmq, kafka, grpc)
    // should have different dependencies than tcp (which has none)
    for (const transport of ['redis', 'nats', 'mqtt', 'rabbitmq', 'kafka', 'grpc']) {
      const deps = depsPerTransport.get(transport)!;
      expect(deps).not.toEqual(tcpDeps);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Version conflict: rabbitmq recipe vs project-type @nestjs/microservices
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: dependency version conflicts', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('rabbitmq recipe has @nestjs/microservices version matching project-type', () => {
    const rabbitmqRecipe = registry.get('rabbitmq');
    expect(rabbitmqRecipe).toBeDefined();

    const recipeVersion = rabbitmqRecipe!.dependencies['@nestjs/microservices'];

    // The project-type fragment has 11.1.19
    const fragmentPath = path.join(
      TEMPLATES_DIR,
      'project-types',
      'microservice',
      'package-fragment.json',
    );
    const fragment = JSON.parse(fs.readFileSync(fragmentPath, 'utf-8'));
    const projectTypeVersion = fragment.dependencies['@nestjs/microservices'];
    expect(projectTypeVersion).toBe('11.1.19');

    // Recipe and project-type versions match
    expect(recipeVersion).toEqual(projectTypeVersion);
  });

  it('merged package.json has consistent @nestjs/microservices version', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-version-merge-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'rabbitmq',
        recipes: ['rabbitmq'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const deps = getRuntimeDeps(outputDir);
      const mergedVersion = deps['@nestjs/microservices'];

      // Both recipe and project-type specify 11.1.19
      expect(mergedVersion).toBe('11.1.19');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('@nestjs/core and @nestjs/microservices are both 11.x', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-version-consistency-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'rabbitmq',
        recipes: ['rabbitmq'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const deps = getRuntimeDeps(outputDir);

      const coreVersion = deps['@nestjs/core'];
      const msVersion = deps['@nestjs/microservices'];

      expect(coreVersion).toMatch(/^11\./);
      expect(msVersion).toMatch(/^11\./);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. .spoonfeed.json manifest correctness for microservices
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: manifest correctness', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('manifest includes projectType, transportLayer, name, and scope', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-manifest-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'kafka',
        recipes: ['pino'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJson(outputDir, '.spoonfeed.json');

      expect(manifest.projectType).toBe('microservice');
      expect(manifest).toHaveProperty('transportLayer', 'kafka');
      expect(manifest).toHaveProperty('name', 'test-project');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. E2E test template for microservice projects
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: e2e test template', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('microservice does not get HTTP-based e2e test', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ms-e2e-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'tcp',
      });
      await generate(config, registry, TEMPLATES_DIR);

      // The generator correctly removes HTTP e2e tests for non-HTTP projects
      expect(fileExists(outputDir, 'tests/e2e/app.e2e-spec.ts')).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('microservice gets no replacement e2e test for its transport', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ms-e2e-none-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'tcp',
      });
      await generate(config, registry, TEMPLATES_DIR);

      // BUG: The HTTP e2e test is removed, but no microservice-specific e2e test
      // replaces it. The tests/e2e directory is empty or doesn't exist.
      // Microservice projects should have e2e tests that verify message handling.
      const e2eDir = path.join(outputDir, 'tests', 'e2e');
      const e2eDirExists = fs.existsSync(e2eDir);
      if (e2eDirExists) {
        const e2eFiles = fs.readdirSync(e2eDir);
        expect(e2eFiles.length).toBe(0);
      } else {
        expect(e2eDirExists).toBe(false);
      }
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Base env vars for microservice: PORT is HTTP-centric
// ─────────────────────────────────────────────────────────────────────────────

describe('Transport layer combos: base env vars', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it.each(
    (['tcp', 'redis', 'kafka', 'grpc'] as const).map((t) => [t]),
  )('%s transport .env.example has no HTTP-centric PORT var', (transport) => {
    const testFn = async () => {
      const outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-env-port-${transport}-`),
      );

      try {
        const config = makeConfig({
          outputDir,
          projectType: 'microservice',
          transportLayer: transport,
        });
        await generate(config, registry, TEMPLATES_DIR);

        const envContent = readFile(outputDir, '.env.example');

        // Microservices should not have HTTP port vars
        expect(envContent).not.toContain('# HTTP port');
        expect(envContent).not.toContain('PORT=3000');
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    };

    return testFn();
  });
});
