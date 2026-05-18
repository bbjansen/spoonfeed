import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { HTTP_ADAPTERS } from '@spoonfeed/types';
import type {
  ProjectConfig,
  ProjectType,
  HttpAdapter,
  RecipeDefinition,
} from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const HTTP_PROJECT_TYPES: ProjectType[] = ['http-api', 'aws-lambda', 'full-stack', 'monorepo'];

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

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

interface PackageJson {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

function readPackageJson(outputDir: string): PackageJson {
  const raw = JSON.parse(
    fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
  ) as Record<string, unknown>;
  return {
    dependencies: (raw.dependencies ?? {}) as Record<string, string>,
    devDependencies: (raw.devDependencies ?? {}) as Record<string, string>,
    scripts: (raw.scripts ?? {}) as Record<string, string>,
  };
}

async function generateProject(
  overrides: Partial<ProjectConfig>,
  registry: RecipeRegistry,
): Promise<string> {
  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'spoonfeed-pkg-integrity-'),
  );
  const config = makeConfig({ ...overrides, outputDir });
  await generate(config, registry, TEMPLATES_DIR);
  return outputDir;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Version consistency
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Version consistency', () => {
  let registry: RecipeRegistry;
  const generatedDirs: string[] = [];

  beforeAll(() => {
    registry = createRegistry();
  });

  afterAll(() => {
    for (const dir of generatedDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe.each(
    HTTP_PROJECT_TYPES.flatMap((pt) =>
      HTTP_ADAPTERS.map((adapter) => ({ projectType: pt, httpAdapter: adapter })),
    ),
  )('$projectType + $httpAdapter', ({ projectType, httpAdapter }) => {
    let pkg: PackageJson;
    let outputDir: string;

    beforeAll(async () => {
      const frontendFramework = projectType === 'full-stack' ? 'nextjs' : undefined;
      outputDir = await generateProject(
        {
          projectType: projectType as ProjectType,
          httpAdapter: httpAdapter as HttpAdapter,
          frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('no duplicate package entries across deps and devDeps', () => {
      const depsKeys = Object.keys(pkg.dependencies);
      const devDepsKeys = Object.keys(pkg.devDependencies);
      const duplicates = depsKeys.filter((key) => devDepsKeys.includes(key));

      // mergePackageJson now deduplicates: packages in deps are removed from devDeps
      expect(duplicates).toEqual([]);
    });

    it('all @nestjs/* packages share the same major.minor version', () => {
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const nestjsPkgs = Object.entries(allDeps).filter(([key]) =>
        key.startsWith('@nestjs/'),
      );

      // Group by major.minor
      const majorMinorVersions = new Map<string, string[]>();
      for (const [name, version] of nestjsPkgs) {
        const match = version.match(/^(\d+\.\d+)/);
        if (match) {
          const majorMinor = match[1];
          if (!majorMinorVersions.has(majorMinor))
            majorMinorVersions.set(majorMinor, []);
          majorMinorVersions.get(majorMinor)!.push(`${name}@${version}`);
        }
      }

      // Independently versioned @nestjs packages (@nestjs/config, @nestjs/cli,
      // @nestjs/schematics, etc.) have their own release cadence and are expected
      // to have different major.minor versions. The important check is below:
      // framework-locked packages must all share the same version.

      // At minimum, the framework-version-locked @nestjs packages should be
      // consistent. Note: @nestjs/config, @nestjs/cli, @nestjs/schematics have
      // their own independent versioning and are excluded from this check.
      const frameworkLockedPackages = nestjsPkgs.filter(([name]) =>
        [
          '@nestjs/common',
          '@nestjs/core',
          '@nestjs/testing',
          '@nestjs/platform-express',
          '@nestjs/platform-fastify',
        ].includes(name),
      );
      const frameworkVersions = new Set(
        frameworkLockedPackages.map(([, v]) => v.match(/^(\d+\.\d+)/)?.[1]),
      );
      expect(frameworkVersions.size).toBeLessThanOrEqual(1);
    });

    it('no version ranges (^, ~, >=, *) — all versions must be exact', () => {
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const rangePattern = /[~^>=*]/;
      const violations: string[] = [];

      for (const [name, version] of Object.entries(allDeps)) {
        if (rangePattern.test(version)) {
          violations.push(`${name}@${version}`);
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('recipe dependencies referenced by templates exist in package.json', () => {
    it('swagger recipe with fastify: @fastify/static is in dependencies', async () => {
      const outputDir = await generateProject(
        { projectType: 'http-api', httpAdapter: 'fastify', recipes: ['swagger'] },
        registry,
      );
      generatedDirs.push(outputDir);
      const pkg = readPackageJson(outputDir);

      expect(pkg.dependencies['@nestjs/swagger']).toBeDefined();
      expect(pkg.dependencies['@fastify/static']).toBeDefined();
    });

    it('swagger recipe with express: @fastify/static is NOT in dependencies', async () => {
      const outputDir = await generateProject(
        {
          projectType: 'http-api',
          httpAdapter: 'express',
          recipes: ['swagger'],
        },
        registry,
      );
      generatedDirs.push(outputDir);
      const pkg = readPackageJson(outputDir);

      expect(pkg.dependencies['@nestjs/swagger']).toBeDefined();
      expect(pkg.dependencies['@fastify/static']).toBeUndefined();
    });

    it('helmet recipe with express: uses express helmet, not @fastify/helmet', async () => {
      const outputDir = await generateProject(
        { projectType: 'http-api', httpAdapter: 'express', recipes: ['helmet'] },
        registry,
      );
      generatedDirs.push(outputDir);
      const pkg = readPackageJson(outputDir);

      expect(pkg.dependencies['helmet']).toBeDefined();
      expect(pkg.dependencies['@fastify/helmet']).toBeUndefined();
    });

    it('csrf recipe with express: uses csrf-csrf + cookie-parser, not @fastify/* variants', async () => {
      const outputDir = await generateProject(
        { projectType: 'http-api', httpAdapter: 'express', recipes: ['csrf'] },
        registry,
      );
      generatedDirs.push(outputDir);
      const pkg = readPackageJson(outputDir);

      expect(pkg.dependencies['csrf-csrf']).toBeDefined();
      expect(pkg.dependencies['cookie-parser']).toBeDefined();
      expect(pkg.dependencies['@fastify/csrf-protection']).toBeUndefined();
      expect(pkg.dependencies['@fastify/cookie']).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Adapter package correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Adapter package correctness', () => {
  let registry: RecipeRegistry;
  const generatedDirs: string[] = [];

  beforeAll(() => {
    registry = createRegistry();
  });

  afterAll(() => {
    for (const dir of generatedDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe.each(HTTP_PROJECT_TYPES)(
    '%s: Express adapter has zero @fastify/* packages',
    (projectType) => {
      let pkg: PackageJson;

      beforeAll(async () => {
        const frontendFramework =
          projectType === 'full-stack' ? 'nextjs' : undefined;
        const outputDir = await generateProject(
          {
            projectType: projectType as ProjectType,
            httpAdapter: 'express',
            frontendFramework:
              frontendFramework as ProjectConfig['frontendFramework'],
          },
          registry,
        );
        generatedDirs.push(outputDir);
        pkg = readPackageJson(outputDir);
      });

      it('no @fastify/* in dependencies', () => {
        const fastifyDeps = Object.keys(pkg.dependencies).filter((k) =>
          k.startsWith('@fastify/'),
        );
        expect(fastifyDeps).toEqual([]);
      });

      it('no @fastify/* in devDependencies', () => {
        const fastifyDevDeps = Object.keys(pkg.devDependencies).filter((k) =>
          k.startsWith('@fastify/'),
        );
        expect(fastifyDevDeps).toEqual([]);
      });

      it('no fastify in dependencies', () => {
        expect(pkg.dependencies['fastify']).toBeUndefined();
      });

      it('no @nestjs/platform-fastify in dependencies', () => {
        expect(pkg.dependencies['@nestjs/platform-fastify']).toBeUndefined();
      });

      it('has @nestjs/platform-express in dependencies', () => {
        expect(pkg.dependencies['@nestjs/platform-express']).toBeDefined();
      });

      it('has express in dependencies', () => {
        expect(pkg.dependencies['express']).toBeDefined();
      });
    },
  );

  describe.each(HTTP_PROJECT_TYPES)(
    '%s: Fastify adapter has zero express packages',
    (projectType) => {
      let pkg: PackageJson;

      beforeAll(async () => {
        const frontendFramework =
          projectType === 'full-stack' ? 'nextjs' : undefined;
        const outputDir = await generateProject(
          {
            projectType: projectType as ProjectType,
            httpAdapter: 'fastify',
            frontendFramework:
              frontendFramework as ProjectConfig['frontendFramework'],
          },
          registry,
        );
        generatedDirs.push(outputDir);
        pkg = readPackageJson(outputDir);
      });

      it('no express in dependencies', () => {
        expect(pkg.dependencies['express']).toBeUndefined();
      });

      it('no @nestjs/platform-express in dependencies', () => {
        expect(pkg.dependencies['@nestjs/platform-express']).toBeUndefined();
      });

      it('no @types/express in deps or devDeps', () => {
        expect(pkg.dependencies['@types/express']).toBeUndefined();
        expect(pkg.devDependencies['@types/express']).toBeUndefined();
      });

      it('has @nestjs/platform-fastify in dependencies', () => {
        expect(pkg.dependencies['@nestjs/platform-fastify']).toBeDefined();
      });

      it('has fastify in dependencies or devDependencies', () => {
        const hasFastify =
          pkg.dependencies['fastify'] || pkg.devDependencies['fastify'];
        expect(hasFastify).toBeDefined();
      });
    },
  );

  describe('Lambda projects have correct serverless adapter', () => {
    it('Express Lambda has @codegenie/serverless-express', async () => {
      const outputDir = await generateProject(
        {
          projectType: 'aws-lambda',
          httpAdapter: 'express',
          cloudProvider: 'aws',
        },
        registry,
      );
      generatedDirs.push(outputDir);
      const pkg = readPackageJson(outputDir);

      expect(
        pkg.dependencies['@codegenie/serverless-express'],
      ).toBeDefined();
      expect(pkg.dependencies['@fastify/aws-lambda']).toBeUndefined();
    });

    it('Fastify Lambda has @fastify/aws-lambda', async () => {
      const outputDir = await generateProject(
        {
          projectType: 'aws-lambda',
          httpAdapter: 'fastify',
          cloudProvider: 'aws',
        },
        registry,
      );
      generatedDirs.push(outputDir);
      const pkg = readPackageJson(outputDir);

      expect(pkg.dependencies['@fastify/aws-lambda']).toBeDefined();
      expect(
        pkg.dependencies['@codegenie/serverless-express'],
      ).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Non-HTTP project types
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Non-HTTP project types', () => {
  let registry: RecipeRegistry;
  const generatedDirs: string[] = [];

  beforeAll(() => {
    registry = createRegistry();
  });

  afterAll(() => {
    for (const dir of generatedDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  const ADAPTER_RUNTIME_DEPS = [
    '@nestjs/platform-express',
    '@nestjs/platform-fastify',
    'express',
    'fastify',
    '@fastify/etag',
    '@fastify/aws-lambda',
    '@codegenie/serverless-express',
  ];

  describe('cli-app', () => {
    let pkg: PackageJson;

    beforeAll(async () => {
      const outputDir = await generateProject(
        { projectType: 'cli-app' },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('has nest-commander in dependencies', () => {
      expect(pkg.dependencies['nest-commander']).toBeDefined();
    });

    it('has nest-commander-testing in devDependencies', () => {
      expect(pkg.devDependencies['nest-commander-testing']).toBeDefined();
    });

    it('has no adapter runtime deps in dependencies', () => {
      for (const dep of ADAPTER_RUNTIME_DEPS) {
        expect(pkg.dependencies[dep]).toBeUndefined();
      }
    });
  });

  describe('scheduled-worker', () => {
    let pkg: PackageJson;

    beforeAll(async () => {
      const outputDir = await generateProject(
        { projectType: 'scheduled-worker' },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('has @nestjs/schedule in dependencies', () => {
      expect(pkg.dependencies['@nestjs/schedule']).toBeDefined();
    });

    it('has no adapter runtime deps in dependencies', () => {
      for (const dep of ADAPTER_RUNTIME_DEPS) {
        expect(pkg.dependencies[dep]).toBeUndefined();
      }
    });
  });

  describe('microservice (tcp)', () => {
    let pkg: PackageJson;

    beforeAll(async () => {
      const outputDir = await generateProject(
        { projectType: 'microservice', transportLayer: 'tcp' },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('has @nestjs/microservices in dependencies', () => {
      expect(pkg.dependencies['@nestjs/microservices']).toBeDefined();
    });

    it('has no adapter runtime deps in dependencies', () => {
      for (const dep of ADAPTER_RUNTIME_DEPS) {
        expect(pkg.dependencies[dep]).toBeUndefined();
      }
    });
  });

  describe('microservice + rabbitmq recipe has transport-specific deps', () => {
    let pkg: PackageJson;

    beforeAll(async () => {
      const outputDir = await generateProject(
        {
          projectType: 'microservice',
          transportLayer: 'tcp',
          recipes: ['rabbitmq'],
        },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('has amqplib in dependencies', () => {
      expect(pkg.dependencies['amqplib']).toBeDefined();
    });

    it('has @types/amqplib in devDependencies', () => {
      expect(pkg.devDependencies['@types/amqplib']).toBeDefined();
    });

    it('has @nestjs/microservices in dependencies', () => {
      expect(pkg.dependencies['@nestjs/microservices']).toBeDefined();
    });

    it('@nestjs/microservices version matches @nestjs/core when rabbitmq recipe is applied', () => {
      const microservicesVersion =
        pkg.dependencies['@nestjs/microservices'];
      const coreVersion = pkg.dependencies['@nestjs/core'];

      // Both rabbitmq recipe and project-type fragment now declare 11.1.19
      expect(microservicesVersion).toBe('11.1.19');
      expect(coreVersion).toBe('11.1.19');
      expect(microservicesVersion).toBe(coreVersion);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Script correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Script correctness', () => {
  let registry: RecipeRegistry;
  const generatedDirs: string[] = [];

  beforeAll(() => {
    registry = createRegistry();
  });

  afterAll(() => {
    for (const dir of generatedDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('flat project layout (http-api)', () => {
    let pkg: PackageJson;

    beforeAll(async () => {
      const outputDir = await generateProject(
        { projectType: 'http-api' },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('build script uses nest build', () => {
      expect(pkg.scripts['build']).toContain('nest build');
    });

    it('start:prod script points to dist/main', () => {
      expect(pkg.scripts['start:prod']).toContain('dist/main');
    });

    it('test scripts use jest --selectProjects', () => {
      expect(pkg.scripts['test']).toContain('jest --selectProjects unit');
      expect(pkg.scripts['test:unit']).toContain(
        'jest --selectProjects unit',
      );
      expect(pkg.scripts['test:e2e']).toContain('jest --selectProjects e2e');
    });
  });

  describe('workspace project layout (full-stack)', () => {
    let pkg: PackageJson;

    beforeAll(async () => {
      const outputDir = await generateProject(
        { projectType: 'full-stack', frontendFramework: 'nextjs' },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('build script uses nx run-many', () => {
      expect(pkg.scripts['build']).toContain('nx run-many');
    });

    it('test script uses nx run-many', () => {
      expect(pkg.scripts['test']).toContain('nx run-many');
    });

    it('has dev script for workspace', () => {
      expect(pkg.scripts['dev']).toContain('nx run-many');
    });
  });

  describe('workspace project layout (monorepo)', () => {
    let pkg: PackageJson;

    beforeAll(async () => {
      const outputDir = await generateProject(
        { projectType: 'monorepo' },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('build script uses nx run-many', () => {
      expect(pkg.scripts['build']).toContain('nx run-many');
    });

    it('test script uses nx run-many', () => {
      expect(pkg.scripts['test']).toContain('nx run-many');
    });

    it('has graph script', () => {
      expect(pkg.scripts['graph']).toContain('nx graph');
    });
  });

  describe('aws-lambda scripts', () => {
    let pkg: PackageJson;

    beforeAll(async () => {
      const outputDir = await generateProject(
        {
          projectType: 'aws-lambda',
          httpAdapter: 'fastify',
          cloudProvider: 'aws',
        },
        registry,
      );
      generatedDirs.push(outputDir);
      pkg = readPackageJson(outputDir);
    });

    it('has standard build/test scripts', () => {
      expect(pkg.scripts['build']).toBeDefined();
      expect(pkg.scripts['test']).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Recipe dep merge order -- overlapping deps from multiple recipes
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Recipe dep merge order', () => {
  let registry: RecipeRegistry;
  let allRecipes: RecipeDefinition[];
  const generatedDirs: string[] = [];

  beforeAll(() => {
    registry = createRegistry();
    allRecipes = registry.getAll();
  });

  afterAll(() => {
    for (const dir of generatedDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rabbitmq recipe @nestjs/microservices version matches project-type fragment', () => {
    const rabbitmq = allRecipes.find((r) => r.id === 'rabbitmq');
    expect(rabbitmq).toBeDefined();
    expect(rabbitmq!.dependencies['@nestjs/microservices']).toBe('11.1.19');

    // The microservice project-type fragment also has 11.1.19
    const fragmentPath = path.join(
      TEMPLATES_DIR,
      'project-types',
      'microservice',
      'package-fragment.json',
    );
    const fragment = JSON.parse(fs.readFileSync(fragmentPath, 'utf-8'));
    expect(fragment.dependencies['@nestjs/microservices']).toBe('11.1.19');
  });

  it('websockets recipe uses @nestjs v11 packages matching base template', () => {
    const ws = allRecipes.find((r) => r.id === 'websockets');
    expect(ws).toBeDefined();
    expect(ws!.dependencies['@nestjs/websockets']).toBe('11.1.19');
    expect(ws!.dependencies['@nestjs/platform-socket.io']).toBe('11.1.19');

    // All core @nestjs packages in base template are v11
    const baseEjs = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'base/package.json.ejs'),
      'utf-8',
    );
    const coreVersionMatch = baseEjs.match(
      /"@nestjs\/core":\s*"(\d+\.\d+\.\d+)"/,
    );
    expect(coreVersionMatch).not.toBeNull();
    expect(coreVersionMatch![1]).toMatch(/^11\./);
  });

  it('multiple recipes with shared @nestjs/swagger dep produce consistent version', async () => {
    // Both pagination and filtering declare @nestjs/swagger@11.4.2
    // Swagger recipe also declares it. They should all agree.
    const outputDir = await generateProject(
      {
        projectType: 'http-api',
        httpAdapter: 'fastify',
        recipes: ['swagger', 'pagination', 'filtering'],
      },
      registry,
    );
    generatedDirs.push(outputDir);
    const pkg = readPackageJson(outputDir);

    expect(pkg.dependencies['@nestjs/swagger']).toBe('11.4.2');
  });

  it('express adapter with recipes that have expressDependencies: express deps win over fastify deps', async () => {
    const outputDir = await generateProject(
      {
        projectType: 'http-api',
        httpAdapter: 'express',
        recipes: ['helmet', 'csrf', 'swagger'],
      },
      registry,
    );
    generatedDirs.push(outputDir);
    const pkg = readPackageJson(outputDir);

    // Helmet: express variant uses 'helmet', not '@fastify/helmet'
    expect(pkg.dependencies['helmet']).toBeDefined();
    expect(pkg.dependencies['@fastify/helmet']).toBeUndefined();

    // CSRF: express variant uses 'csrf-csrf' + 'cookie-parser', not @fastify/*
    expect(pkg.dependencies['csrf-csrf']).toBeDefined();
    expect(pkg.dependencies['cookie-parser']).toBeDefined();
    expect(pkg.dependencies['@fastify/csrf-protection']).toBeUndefined();
    expect(pkg.dependencies['@fastify/cookie']).toBeUndefined();

    // Swagger: express variant omits @fastify/static
    expect(pkg.dependencies['@nestjs/swagger']).toBeDefined();
    expect(pkg.dependencies['@fastify/static']).toBeUndefined();
  });

  it('fastify adapter with recipes that have expressDependencies: fastify deps used, no express deps', async () => {
    const outputDir = await generateProject(
      {
        projectType: 'http-api',
        httpAdapter: 'fastify',
        recipes: ['helmet', 'csrf', 'swagger'],
      },
      registry,
    );
    generatedDirs.push(outputDir);
    const pkg = readPackageJson(outputDir);

    // Helmet: fastify variant
    expect(pkg.dependencies['@fastify/helmet']).toBeDefined();
    expect(pkg.dependencies['helmet']).toBeUndefined();

    // CSRF: fastify variant
    expect(pkg.dependencies['@fastify/csrf-protection']).toBeDefined();
    expect(pkg.dependencies['@fastify/cookie']).toBeDefined();
    expect(pkg.dependencies['csrf-csrf']).toBeUndefined();
    expect(pkg.dependencies['cookie-parser']).toBeUndefined();

    // Swagger: fastify variant includes @fastify/static
    expect(pkg.dependencies['@fastify/static']).toBeDefined();
  });

  // BUG: file-upload recipe devDependencies has @types/multer regardless of
  // adapter. For fastify projects, @types/multer is unnecessary since
  // @fastify/multipart is used.
  it('BUG: file-upload recipe adds @types/multer to devDeps even for fastify adapter', async () => {
    const outputDir = await generateProject(
      {
        projectType: 'http-api',
        httpAdapter: 'fastify',
        recipes: ['file-upload'],
      },
      registry,
    );
    generatedDirs.push(outputDir);
    const pkg = readPackageJson(outputDir);

    // Fastify uses @fastify/multipart, not multer
    expect(pkg.dependencies['@fastify/multipart']).toBeDefined();
    expect(pkg.dependencies['multer']).toBeUndefined();

    // BUG: @types/multer is in devDeps even though multer is not a dependency.
    // The devDependencies are always merged (not adapter-conditional), so
    // @types/multer leaks in regardless.
    expect(pkg.devDependencies['@types/multer']).toBe('2.1.0');
  });

  it('adminjs recipe express variant includes express-specific middleware deps', () => {
    const adminjs = allRecipes.find((r) => r.id === 'adminjs');
    expect(adminjs).toBeDefined();

    // Fastify variant
    expect(adminjs!.dependencies['@adminjs/fastify']).toBeDefined();
    expect(adminjs!.dependencies['express-session']).toBeUndefined();

    // Express variant has express-specific extras
    expect(adminjs!.expressDependencies!['express-session']).toBeDefined();
    expect(adminjs!.expressDependencies!['express-formidable']).toBeDefined();
  });

  describe('deps/devDeps deduplication in mergePackageJson', () => {
    it('mergePackageJson removes packages from devDeps when they appear in deps', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { mergePackageJson } = require('@spoonfeed/generator/package-json-merger');

      const base = {
        name: 'test',
        dependencies: {},
        devDependencies: {
          '@nestjs/platform-express': '11.1.19',
          '@types/express': '5.0.3',
        },
      };

      const fragment = {
        dependencies: {
          '@nestjs/platform-express': '11.1.19',
          express: '5.1.0',
        },
      };

      const result = mergePackageJson(base, [fragment]);
      const deps = result.dependencies as Record<string, string>;
      const devDeps = result.devDependencies as Record<string, string>;

      // @nestjs/platform-express is in dependencies (from fragment)
      expect(deps['@nestjs/platform-express']).toBe('11.1.19');

      // Deduplication: @nestjs/platform-express is removed from devDependencies
      expect(devDeps['@nestjs/platform-express']).toBeUndefined();

      // Unrelated devDeps are preserved
      expect(devDeps['@types/express']).toBe('5.0.3');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cross-cutting: @nestjs version consistency audit across ALL recipe defs
// ─────────────────────────────────────────────────────────────────────────────

describe('6. @nestjs version audit across all recipe definitions', () => {
  let allRecipes: RecipeDefinition[];

  beforeAll(() => {
    const registry = createRegistry();
    allRecipes = registry.getAll();
  });

  it('no recipe declares a framework-locked @nestjs/* package with a mismatched major version', () => {
    // Framework-locked packages must share the same major.minor as @nestjs/core.
    // Independently versioned packages (@nestjs/typeorm, @nestjs/passport, etc.)
    // follow their own release cadence and are excluded from this check.
    const frameworkLocked = new Set([
      '@nestjs/common',
      '@nestjs/core',
      '@nestjs/testing',
      '@nestjs/platform-express',
      '@nestjs/platform-fastify',
      '@nestjs/microservices',
      '@nestjs/websockets',
      '@nestjs/platform-socket.io',
    ]);

    const violations: string[] = [];

    for (const recipe of allRecipes) {
      const allDeps = {
        ...recipe.dependencies,
        ...recipe.devDependencies,
        ...(recipe.expressDependencies ?? {}),
      };

      for (const [pkg, version] of Object.entries(allDeps)) {
        if (!frameworkLocked.has(pkg)) continue;

        const majorMatch = version.match(/^(\d+)\./);
        if (majorMatch && majorMatch[1] !== '11') {
          violations.push(`${recipe.id}: ${pkg}@${version}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('no @nestjs/* package has conflicting versions across base, project-types, and recipes', () => {
    const nestjsVersions = new Map<string, Map<string, string[]>>();

    // Collect from base template
    const baseEjs = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'base/package.json.ejs'),
      'utf-8',
    );
    const baseRegex = /"(@nestjs\/[^"]+)":\s*"(\d[^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = baseRegex.exec(baseEjs)) !== null) {
      const [, pkg, ver] = m;
      if (!nestjsVersions.has(pkg)) nestjsVersions.set(pkg, new Map());
      const verMap = nestjsVersions.get(pkg)!;
      if (!verMap.has(ver)) verMap.set(ver, []);
      verMap.get(ver)!.push('base');
    }

    // Collect from project-type fragments
    const ptDir = path.join(TEMPLATES_DIR, 'project-types');
    for (const dir of fs.readdirSync(ptDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const fragPath = path.join(ptDir, dir.name, 'package-fragment.json');
      if (!fs.existsSync(fragPath)) continue;
      const content = JSON.parse(fs.readFileSync(fragPath, 'utf-8'));
      for (const section of ['dependencies', 'devDependencies']) {
        if (!content[section]) continue;
        for (const [pkg, ver] of Object.entries(content[section])) {
          if (!pkg.startsWith('@nestjs/')) continue;
          if (!nestjsVersions.has(pkg))
            nestjsVersions.set(pkg, new Map());
          const verMap = nestjsVersions.get(pkg)!;
          if (!verMap.has(ver as string)) verMap.set(ver as string, []);
          verMap.get(ver as string)!.push(`project-type/${dir.name}`);
        }
      }
    }

    // Collect from recipes
    for (const recipe of allRecipes) {
      for (const [pkg, ver] of Object.entries(recipe.dependencies)) {
        if (!pkg.startsWith('@nestjs/')) continue;
        if (!nestjsVersions.has(pkg)) nestjsVersions.set(pkg, new Map());
        const verMap = nestjsVersions.get(pkg)!;
        if (!verMap.has(ver)) verMap.set(ver, []);
        verMap.get(ver)!.push(recipe.id);
      }
    }

    // Find packages with multiple versions
    const mismatches: string[] = [];
    for (const [pkg, verMap] of nestjsVersions) {
      if (verMap.size > 1) {
        const details = [...verMap.entries()]
          .map(([ver, sources]) => `${ver} (${sources.join(', ')})`)
          .join(' vs ');
        mismatches.push(`${pkg}: ${details}`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});
