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

const TEXT_FILE_EXTENSIONS = ['.ts', '.js', '.json', '.yml', '.yaml', '.md', '.mdc', '.mjs'];

const RECIPES: RecipeId[] = [
  'swagger',
  'pino',
  'jwt-auth',
  'helmet',
  'csrf',
  'cors',
  'typeorm-postgres',
  'health-checks',
  'correlation-id',
  'opentelemetry',
  'pagination',
  'file-upload',
  'sentry',
  'api-keys',
];

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'ejs-render-test',
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

/**
 * Recursively collect all files under a directory matching the given extensions.
 */
function walkFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('EJS template rendering: Express vs Fastify', () => {
  let expressDir: string;
  let fastifyDir: string;
  let expressFiles: string[];
  let fastifyFiles: string[];
  const registry = createRegistry();

  beforeAll(async () => {
    expressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ejs-express-'));
    fastifyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ejs-fastify-'));

    const expressConfig = makeConfig({
      outputDir: expressDir,
      httpAdapter: 'express',
      projectType: 'http-api',
      recipes: RECIPES,
    });

    const fastifyConfig = makeConfig({
      outputDir: fastifyDir,
      httpAdapter: 'fastify',
      projectType: 'http-api',
      recipes: RECIPES,
    });

    await generate(expressConfig, registry, TEMPLATES_DIR);
    await generate(fastifyConfig, registry, TEMPLATES_DIR);

    expressFiles = walkFiles(expressDir, TEXT_FILE_EXTENSIONS);
    fastifyFiles = walkFiles(fastifyDir, TEXT_FILE_EXTENSIONS);
  });

  afterAll(() => {
    fs.rmSync(expressDir, { recursive: true, force: true });
    fs.rmSync(fastifyDir, { recursive: true, force: true });
  });

  it('should generate files for both adapters', () => {
    expect(expressFiles.length).toBeGreaterThan(0);
    expect(fastifyFiles.length).toBeGreaterThan(0);
  });

  describe('No raw EJS tags in rendered output', () => {
    it('Express project: no file contains raw EJS tags', () => {
      const failures: string[] = [];

      for (const filePath of expressFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('<%')) {
          const relative = path.relative(expressDir, filePath);
          failures.push(relative);
        }
      }

      expect(failures).toEqual([]);
    });

    it('Fastify project: no file contains raw EJS tags', () => {
      const failures: string[] = [];

      for (const filePath of fastifyFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('<%')) {
          const relative = path.relative(fastifyDir, filePath);
          failures.push(relative);
        }
      }

      expect(failures).toEqual([]);
    });
  });

  describe('No empty or whitespace-only .ts files', () => {
    it('Express project: no .ts file is empty or whitespace-only', () => {
      const emptyFiles: string[] = [];

      const tsFiles = expressFiles.filter((f) => f.endsWith('.ts'));
      for (const filePath of tsFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.trim().length === 0) {
          const relative = path.relative(expressDir, filePath);
          emptyFiles.push(relative);
        }
      }

      expect(emptyFiles).toEqual([]);
    });

    it('Fastify project: no .ts file is empty or whitespace-only', () => {
      const emptyFiles: string[] = [];

      const tsFiles = fastifyFiles.filter((f) => f.endsWith('.ts'));
      for (const filePath of tsFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.trim().length === 0) {
          const relative = path.relative(fastifyDir, filePath);
          emptyFiles.push(relative);
        }
      }

      expect(emptyFiles).toEqual([]);
    });
  });

  describe('Adapter-specific content isolation', () => {
    it('Express project: no .ts file references FastifyAdapter, NestFastifyApplication, or imports from fastify', () => {
      const violations: { file: string; matches: string[] }[] = [];

      const tsFiles = expressFiles.filter((f) => f.endsWith('.ts'));
      for (const filePath of tsFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const matches: string[] = [];

        if (content.includes('FastifyAdapter')) {
          matches.push('FastifyAdapter');
        }
        if (content.includes('NestFastifyApplication')) {
          matches.push('NestFastifyApplication');
        }
        if (/from\s+['"]fastify['"]/.test(content)) {
          matches.push("import from 'fastify'");
        }

        if (matches.length > 0) {
          const relative = path.relative(expressDir, filePath);
          violations.push({ file: relative, matches });
        }
      }

      if (violations.length > 0) {
        const summary = violations
          .map((v) => `  ${v.file}: ${v.matches.join(', ')}`)
          .join('\n');
        fail(`Express project contains Fastify references:\n${summary}`);
      }
    });

    it('Fastify project: no .ts file in src/ references ExpressAdapter or imports from express', () => {
      const violations: { file: string; matches: string[] }[] = [];

      const srcTsFiles = fastifyFiles.filter(
        (f) => f.endsWith('.ts') && f.includes(`${path.sep}src${path.sep}`),
      );

      for (const filePath of srcTsFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const matches: string[] = [];

        if (content.includes('ExpressAdapter')) {
          matches.push('ExpressAdapter');
        }
        if (/from\s+['"]express['"]/.test(content)) {
          matches.push("import from 'express'");
        }

        if (matches.length > 0) {
          const relative = path.relative(fastifyDir, filePath);
          violations.push({ file: relative, matches });
        }
      }

      if (violations.length > 0) {
        const summary = violations
          .map((v) => `  ${v.file}: ${v.matches.join(', ')}`)
          .join('\n');
        fail(`Fastify project src/ contains Express references:\n${summary}`);
      }
    });
  });
});
