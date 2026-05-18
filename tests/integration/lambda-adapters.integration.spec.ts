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

const SHARED_RECIPES: RecipeId[] = ['pino', 'cors', 'helmet', 'swagger'];

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'lambda-test-project',
    scope: undefined,
    projectType: 'aws-lambda',
    cloudProvider: 'aws',
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

function fileExists(outputDir: string, filePath: string): boolean {
  return fs.existsSync(path.join(outputDir, filePath));
}

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

/**
 * Recursively collect all file paths under `dir`, relative to `base`.
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

describe('Lambda adapters: Express vs Fastify with identical recipes', () => {
  let expressDir: string;
  let fastifyDir: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();

    expressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-lambda-express-'));
    fastifyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-lambda-fastify-'));

    const expressConfig = makeConfig({
      outputDir: expressDir,
      httpAdapter: 'express',
      recipes: [...SHARED_RECIPES],
    });

    const fastifyConfig = makeConfig({
      outputDir: fastifyDir,
      httpAdapter: 'fastify',
      recipes: [...SHARED_RECIPES],
    });

    await generate(expressConfig, registry, TEMPLATES_DIR);
    await generate(fastifyConfig, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(expressDir, { recursive: true, force: true });
    fs.rmSync(fastifyDir, { recursive: true, force: true });
  });

  // ── 1. Express Lambda: adapter-specific packages ─────────────────

  describe('Express Lambda: correct adapter packages', () => {
    it('package.json has @codegenie/serverless-express', () => {
      const pkg = readJson(expressDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['@codegenie/serverless-express']).toBeDefined();
    });

    it('package.json has @nestjs/platform-express and express', () => {
      const pkg = readJson(expressDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['@nestjs/platform-express']).toBeDefined();
      expect(deps['express']).toBeDefined();
    });

    it('package.json has NO @fastify/* packages', () => {
      const pkg = readJson(expressDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      const devDeps = (pkg.devDependencies as Record<string, string>) ?? {};
      const allDeps = { ...deps, ...devDeps };

      const fastifyPackages = Object.keys(allDeps).filter((dep) => dep.startsWith('@fastify/'));
      expect(fastifyPackages).toEqual([]);
    });

    it('package.json has NO fastify or @nestjs/platform-fastify', () => {
      const pkg = readJson(expressDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['fastify']).toBeUndefined();
      expect(deps['@nestjs/platform-fastify']).toBeUndefined();
    });
  });

  // ── 2. Fastify Lambda: adapter-specific packages ─────────────────

  describe('Fastify Lambda: correct adapter packages', () => {
    it('package.json has @fastify/aws-lambda', () => {
      const pkg = readJson(fastifyDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['@fastify/aws-lambda']).toBeDefined();
    });

    it('package.json has @nestjs/platform-fastify and fastify', () => {
      const pkg = readJson(fastifyDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['@nestjs/platform-fastify']).toBeDefined();
      expect(deps['fastify']).toBeDefined();
    });

    it('package.json has NO express or serverless-express packages', () => {
      const pkg = readJson(fastifyDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['express']).toBeUndefined();
      expect(deps['@nestjs/platform-express']).toBeUndefined();
      expect(deps['@codegenie/serverless-express']).toBeUndefined();
    });
  });

  // ── 3. Express Lambda: main.ts uses serverless-express bootstrap ──

  describe('Express Lambda: main.ts bootstrap', () => {
    it('main.ts imports and uses serverlessExpress', () => {
      const mainTs = readFile(expressDir, 'src/main.ts');

      expect(mainTs).toContain("from '@codegenie/serverless-express'");
      expect(mainTs).toContain('serverlessExpress');
    });

    it('main.ts uses ExpressAdapter', () => {
      const mainTs = readFile(expressDir, 'src/main.ts');

      expect(mainTs).toContain('ExpressAdapter');
      expect(mainTs).toContain("from '@nestjs/platform-express'");
    });

    it('main.ts has NO Fastify references', () => {
      const mainTs = readFile(expressDir, 'src/main.ts');

      expect(mainTs).not.toContain('FastifyAdapter');
      expect(mainTs).not.toContain('awsLambdaFastify');
      expect(mainTs).not.toContain('@fastify/aws-lambda');
      expect(mainTs).not.toContain('NestFastifyApplication');
    });
  });

  // ── 4. Fastify Lambda: main.ts uses @fastify/aws-lambda bootstrap ──

  describe('Fastify Lambda: main.ts bootstrap', () => {
    it('main.ts imports and uses awsLambdaFastify', () => {
      const mainTs = readFile(fastifyDir, 'src/main.ts');

      expect(mainTs).toContain("from '@fastify/aws-lambda'");
      expect(mainTs).toContain('awsLambdaFastify');
    });

    it('main.ts uses FastifyAdapter and NestFastifyApplication', () => {
      const mainTs = readFile(fastifyDir, 'src/main.ts');

      expect(mainTs).toContain('FastifyAdapter');
      expect(mainTs).toContain('NestFastifyApplication');
    });

    it('main.ts has NO Express references', () => {
      const mainTs = readFile(fastifyDir, 'src/main.ts');

      expect(mainTs).not.toContain('ExpressAdapter');
      expect(mainTs).not.toContain('serverlessExpress');
      expect(mainTs).not.toContain('@codegenie/serverless-express');
      expect(mainTs).not.toContain("from 'express'");
    });
  });

  // ── 5. No Fastify references anywhere in Express project ──────────

  describe('Express Lambda: no Fastify contamination across project', () => {
    it('no file in the project imports from fastify or @fastify/*', () => {
      const files = collectFiles(expressDir, expressDir);
      const violations: string[] = [];

      for (const file of files) {
        if (!file.endsWith('.ts') && !file.endsWith('.json')) continue;
        if (file === 'package-lock.json' || file === '.spoonfeed.json') continue;

        const content = readFile(expressDir, file);
        if (file.endsWith('.json')) {
          // In JSON files, check for fastify package references
          if (content.includes('@fastify/') || content.includes('"fastify"')) {
            violations.push(`${file} contains fastify reference`);
          }
        } else {
          // In TS files, check for fastify imports
          if (content.includes("from 'fastify'") || content.includes("from '@fastify/")) {
            violations.push(`${file} imports from fastify`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // ── 6. Both produce valid .env files ──────────────────────────────

  describe('both projects produce valid .env files', () => {
    it('Express Lambda .env.example has base vars and recipe env vars', () => {
      const envContent = readFile(expressDir, '.env.example');

      // Base vars
      expect(envContent).toContain('PORT');
      expect(envContent).toContain('NODE_ENV');

      // CORS recipe env vars
      expect(envContent).toContain('CORS_ORIGIN');

      // Pino recipe env vars
      expect(envContent).toContain('LOG_LEVEL');

      // Swagger recipe env vars
      expect(envContent).toContain('SWAGGER_ENABLED');
      expect(envContent).toContain('SWAGGER_PATH');
    });

    it('Fastify Lambda .env.example has base vars and recipe env vars', () => {
      const envContent = readFile(fastifyDir, '.env.example');

      // Base vars
      expect(envContent).toContain('PORT');
      expect(envContent).toContain('NODE_ENV');

      // CORS recipe env vars
      expect(envContent).toContain('CORS_ORIGIN');

      // Pino recipe env vars
      expect(envContent).toContain('LOG_LEVEL');

      // Swagger recipe env vars
      expect(envContent).toContain('SWAGGER_ENABLED');
      expect(envContent).toContain('SWAGGER_PATH');
    });

    it('.env.example files are identical between adapters', () => {
      const expressEnv = readFile(expressDir, '.env.example');
      const fastifyEnv = readFile(fastifyDir, '.env.example');

      expect(expressEnv).toEqual(fastifyEnv);
    });
  });

  // ── 7. Both produce proper AI context ─────────────────────────────

  describe('both projects produce proper AI context', () => {
    it('Express Lambda CLAUDE.md mentions aws-lambda and recipe sections', () => {
      const claudeMd = readFile(expressDir, 'CLAUDE.md');

      expect(claudeMd).toContain('aws-lambda');
      expect(claudeMd).toContain('Swagger');
      expect(claudeMd).toContain('Pino');
      expect(claudeMd).toContain('Helmet');
      expect(claudeMd).toContain('CORS');
    });

    it('Fastify Lambda CLAUDE.md mentions aws-lambda and recipe sections', () => {
      const claudeMd = readFile(fastifyDir, 'CLAUDE.md');

      expect(claudeMd).toContain('aws-lambda');
      expect(claudeMd).toContain('Swagger');
      expect(claudeMd).toContain('Pino');
      expect(claudeMd).toContain('Helmet');
      expect(claudeMd).toContain('CORS');
    });
  });

  // ── 8. Both produce proper manifests ──────────────────────────────

  describe('both projects produce proper .spoonfeed.json manifests', () => {
    it('Express Lambda manifest records correct projectType and httpAdapter', () => {
      const manifest = readJson(expressDir, '.spoonfeed.json');

      expect(manifest.projectType).toBe('aws-lambda');
      expect(manifest.httpAdapter).toBe('express');
      expect(manifest.cloudProvider).toBe('aws');
      expect(manifest.generatedAt).toBeDefined();
    });

    it('Fastify Lambda manifest records correct projectType and httpAdapter', () => {
      const manifest = readJson(fastifyDir, '.spoonfeed.json');

      expect(manifest.projectType).toBe('aws-lambda');
      expect(manifest.httpAdapter).toBe('fastify');
      expect(manifest.cloudProvider).toBe('aws');
      expect(manifest.generatedAt).toBeDefined();
    });

    it('both manifests list all four recipes', () => {
      const expressManifest = readJson(expressDir, '.spoonfeed.json');
      const fastifyManifest = readJson(fastifyDir, '.spoonfeed.json');

      const expressRecipes = Object.keys(
        expressManifest.recipes as Record<string, unknown>,
      ).sort();
      const fastifyRecipes = Object.keys(
        fastifyManifest.recipes as Record<string, unknown>,
      ).sort();

      expect(expressRecipes).toEqual(['cors', 'helmet', 'pino', 'swagger']);
      expect(fastifyRecipes).toEqual(['cors', 'helmet', 'pino', 'swagger']);
    });

    it('manifests are identical except for httpAdapter and timestamps', () => {
      const expressManifest = readJson(expressDir, '.spoonfeed.json');
      const fastifyManifest = readJson(fastifyDir, '.spoonfeed.json');

      // Strip fields that intentionally differ
      delete expressManifest.generatedAt;
      delete fastifyManifest.generatedAt;
      delete expressManifest.httpAdapter;
      delete fastifyManifest.httpAdapter;

      // Strip per-recipe installedAt timestamps and mainTsBlocks (adapter-dependent)
      const expressRecipes = expressManifest.recipes as
        | Record<string, Record<string, unknown>>
        | undefined;
      const fastifyRecipes = fastifyManifest.recipes as
        | Record<string, Record<string, unknown>>
        | undefined;

      if (expressRecipes) {
        for (const recipe of Object.values(expressRecipes)) {
          delete recipe.installedAt;
          delete recipe.mainTsBlocks;
        }
      }
      if (fastifyRecipes) {
        for (const recipe of Object.values(fastifyRecipes)) {
          delete recipe.installedAt;
          delete recipe.mainTsBlocks;
        }
      }

      expect(expressManifest).toEqual(fastifyManifest);
    });
  });

  // ── 9. Recipe mainTsSetup blocks are adapter-appropriate ──────────

  describe('recipe mainTsSetup blocks are adapter-appropriate', () => {
    it('Express Lambda: helmet uses app.use(helmet()) not app.register()', () => {
      const mainTs = readFile(expressDir, 'src/main.ts');

      expect(mainTs).toContain('app.use(');
      expect(mainTs).toContain("from 'helmet'");
      expect(mainTs).not.toContain("from '@fastify/helmet'");
      expect(mainTs).not.toContain('app.register(');
    });

    it('Fastify Lambda: helmet uses app.register(helmet) not app.use()', () => {
      const mainTs = readFile(fastifyDir, 'src/main.ts');

      expect(mainTs).toContain('app.register(');
      expect(mainTs).toContain("from '@fastify/helmet'");
      expect(mainTs).not.toContain("from 'helmet'");
    });

    it('Express Lambda: swagger setup is present in main.ts', () => {
      const mainTs = readFile(expressDir, 'src/main.ts');

      expect(mainTs).toContain('SwaggerModule');
      expect(mainTs).toContain('DocumentBuilder');
      expect(mainTs).toContain("from '@nestjs/swagger'");
    });

    it('Fastify Lambda: swagger setup is present in main.ts', () => {
      const mainTs = readFile(fastifyDir, 'src/main.ts');

      expect(mainTs).toContain('SwaggerModule');
      expect(mainTs).toContain('DocumentBuilder');
      expect(mainTs).toContain("from '@nestjs/swagger'");
    });

    it('Express Lambda: swagger deps use express variant (no @fastify/static)', () => {
      const pkg = readJson(expressDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['@nestjs/swagger']).toBeDefined();
      expect(deps['@fastify/static']).toBeUndefined();
    });

    it('Fastify Lambda: swagger deps include @fastify/static', () => {
      const pkg = readJson(fastifyDir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;

      expect(deps['@nestjs/swagger']).toBeDefined();
      expect(deps['@fastify/static']).toBeDefined();
    });

    it('Express Lambda manifest records helmet mainTsBlock', () => {
      const manifest = readJson(expressDir, '.spoonfeed.json');
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;

      expect(recipes['helmet'].mainTsBlocks).toEqual(['helmet']);
    });

    it('Fastify Lambda manifest records helmet mainTsBlock', () => {
      const manifest = readJson(fastifyDir, '.spoonfeed.json');
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;

      expect(recipes['helmet'].mainTsBlocks).toEqual(['helmet']);
    });

    it('both manifests record swagger mainTsBlock', () => {
      const expressManifest = readJson(expressDir, '.spoonfeed.json');
      const fastifyManifest = readJson(fastifyDir, '.spoonfeed.json');

      const expressRecipes = expressManifest.recipes as Record<string, Record<string, unknown>>;
      const fastifyRecipes = fastifyManifest.recipes as Record<string, Record<string, unknown>>;

      expect(expressRecipes['swagger'].mainTsBlocks).toEqual(['swagger']);
      expect(fastifyRecipes['swagger'].mainTsBlocks).toEqual(['swagger']);
    });
  });

  // ── 10. Both include @types/aws-lambda from project-type fragment ──

  describe('both projects include aws-lambda type definitions', () => {
    it('Express Lambda has @types/aws-lambda in devDependencies', () => {
      const pkg = readJson(expressDir, 'package.json');
      const devDeps = pkg.devDependencies as Record<string, string>;

      expect(devDeps['@types/aws-lambda']).toBeDefined();
    });

    it('Fastify Lambda has @types/aws-lambda in devDependencies', () => {
      const pkg = readJson(fastifyDir, 'package.json');
      const devDeps = pkg.devDependencies as Record<string, string>;

      expect(devDeps['@types/aws-lambda']).toBeDefined();
    });
  });
});
