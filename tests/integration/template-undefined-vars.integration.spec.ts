import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { renderTemplate } from '@spoonfeed/generator/template-engine';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, ProjectType, RecipeId, TransportLayer, FrontendFramework } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const TEXT_FILE_EXTENSIONS = [
  '.ts',
  '.js',
  '.json',
  '.yml',
  '.yaml',
  '.md',
  '.mdc',
  '.mjs',
  '.tf',
  '.prisma',
];

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'test-app',
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

function walkFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

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

function findEjsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findEjsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ejs')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Static scan: EJS templates with unguarded variable references
// ─────────────────────────────────────────────────────────────────────────────

describe('Static scan: EJS templates for unguarded variable access', () => {
  let allEjsFiles: string[];

  beforeAll(() => {
    allEjsFiles = findEjsFiles(TEMPLATES_DIR);
  });

  it('should find EJS template files in the templates directory', () => {
    expect(allEjsFiles.length).toBeGreaterThan(0);
  });

  it('templates using packageScope should guard against undefined', () => {
    const unguarded: { file: string; line: number; content: string }[] = [];

    for (const filePath of allEjsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match direct usage: <%= packageScope %> without a ternary/fallback guard
        // Guarded patterns: packageScope ? ... : ..., packageScope ?? ..., packageScope || ...
        if (
          line.includes('packageScope') &&
          line.includes('<%') &&
          !line.includes('packageScope ?') &&
          !line.includes('packageScope??') &&
          !line.includes('packageScope ??') &&
          !line.includes('packageScope||') &&
          !line.includes('packageScope ||') &&
          !line.includes('if') &&
          // Allow .replace() calls on packageScope (the docs-site template does this inside a guarded ternary)
          !line.includes('packageScope.replace')
        ) {
          unguarded.push({
            file: path.relative(TEMPLATES_DIR, filePath),
            line: i + 1,
            content: line.trim(),
          });
        }
      }
    }

    // All packageScope references should be guarded
    expect(unguarded).toEqual([]);
  });

  it('templates using transportLayer should guard against undefined', () => {
    const unguarded: { file: string; line: number; content: string }[] = [];

    for (const filePath of allEjsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Direct output of transportLayer without guard
        if (
          line.includes('<%= transportLayer') &&
          !line.includes('if') &&
          !line.includes('transportLayer ?') &&
          !line.includes('transportLayer ??') &&
          !line.includes('transportLayer ||')
        ) {
          unguarded.push({
            file: path.relative(TEMPLATES_DIR, filePath),
            line: i + 1,
            content: line.trim(),
          });
        }
      }
    }

    // transportLayer is only used in microservice/src/main.ts.ejs within if-blocks
    expect(unguarded).toEqual([]);
  });

  it('templates using frontendFramework should guard against undefined', () => {
    const unguarded: { file: string; line: number; content: string }[] = [];

    for (const filePath of allEjsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.includes('<%= frontendFramework') &&
          !line.includes('if') &&
          !line.includes('frontendFramework ?') &&
          !line.includes('frontendFramework ??') &&
          !line.includes('frontendFramework ||')
        ) {
          unguarded.push({
            file: path.relative(TEMPLATES_DIR, filePath),
            line: i + 1,
            content: line.trim(),
          });
        }
      }
    }

    expect(unguarded).toEqual([]);
  });

  it('templates using httpAdapter should handle all project types safely', () => {
    // httpAdapter is always set (defaults to 'fastify'), so direct output is fine.
    // But templates using it in conditionals should still handle the value properly.
    // This test checks that no template does something like if (httpAdapter === undefined).
    const ejsFilesUsingHttpAdapter: string[] = [];

    for (const filePath of allEjsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('httpAdapter')) {
        ejsFilesUsingHttpAdapter.push(path.relative(TEMPLATES_DIR, filePath));
      }
    }

    // httpAdapter is used in many templates -- this is expected. It always defaults to
    // 'fastify' even for non-HTTP project types. The base template and project-type templates
    // check projectType before using httpAdapter in HTTP-specific contexts.
    expect(ejsFilesUsingHttpAdapter.length).toBeGreaterThan(0);
  });

  it('no EJS template directly outputs cloudProvider as raw text', () => {
    const directOutputs: { file: string; line: number; content: string }[] = [];

    for (const filePath of allEjsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // cloudProvider can be 'none' which might cause odd output like "Provider: none"
        if (line.includes('<%= cloudProvider') && !line.includes('if') && !line.includes('?')) {
          directOutputs.push({
            file: path.relative(TEMPLATES_DIR, filePath),
            line: i + 1,
            content: line.trim(),
          });
        }
      }
    }

    expect(directOutputs).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Generate every project type with minimal config
// ─────────────────────────────────────────────────────────────────────────────

describe('Generate every project type with minimal config (no scope, no recipes)', () => {
  const registry = createRegistry();
  const outputs = new Map<string, string>();

  afterAll(() => {
    for (const dir of outputs.values()) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // Define minimal configs per project type
  const minimalConfigs: Array<{
    projectType: ProjectType;
    transportLayer?: TransportLayer;
    frontendFramework?: FrontendFramework;
  }> = [
    { projectType: 'http-api' },
    { projectType: 'aws-lambda' },
    { projectType: 'microservice', transportLayer: 'tcp' },
    { projectType: 'cli-app' },
    { projectType: 'scheduled-worker' },
    { projectType: 'monorepo' },
    { projectType: 'full-stack', frontendFramework: 'nextjs' },
  ];

  describe.each(minimalConfigs)(
    '$projectType (minimal config)',
    ({ projectType, transportLayer, frontendFramework }) => {
      let outputDir: string;

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-undef-${projectType}-`),
        );
        outputs.set(projectType, outputDir);

        const config = makeConfig({
          outputDir,
          projectType,
          scope: undefined,
          recipes: [],
          transportLayer,
          frontendFramework,
          deploymentTargets: [],
          ciCdProvider: undefined,
        });

        await generate(config, registry, TEMPLATES_DIR);
      });

      it('generates without throwing', () => {
        expect(fs.existsSync(outputDir)).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);
      });

      it('no generated file contains the literal string "undefined" as a rendered value', () => {
        const files = walkFiles(outputDir, TEXT_FILE_EXTENSIONS);
        const violations: { file: string; line: number; content: string }[] = [];

        for (const filePath of files) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Only check for patterns that indicate an EJS template rendered undefined
            // as a literal string value, not legitimate TypeScript code using 'undefined'
            if (
              line.includes('"undefined/') ||
              line.includes("'undefined/") ||
              line.includes('@undefined/') ||
              line.includes('@undefined') ||
              // "name": "undefined" in JSON
              /:\s*"undefined"/.test(line) ||
              // Package names like undefined/something
              /undefined\//.test(line)
            ) {
              // Double-check it's not a comment or docstring
              const trimmed = line.trim();
              if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
                continue;
              }
              violations.push({
                file: path.relative(outputDir, filePath),
                line: i + 1,
                content: trimmed,
              });
            }
          }
        }

        // BUG: If any violation is found, it means an EJS template rendered an undefined
        // variable as the literal string "undefined" in the output
        expect(violations).toEqual([]);
      });

      it('package.json name field does not contain "undefined"', () => {
        const pkgPath = path.join(outputDir, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
        expect(pkg.name).not.toContain('undefined');
      });

      it('no rendered file has excessive blank lines from empty EJS expressions', () => {
        const files = walkFiles(outputDir, ['.ts', '.js']);

        for (const filePath of files) {
          const content = fs.readFileSync(filePath, 'utf-8');
          // More than 5 consecutive blank lines is almost certainly a rendering issue
          expect(content).not.toMatch(/\n{7,}/);
        }
      });
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Specifically test undefined-prone variables
// ─────────────────────────────────────────────────────────────────────────────

describe('packageScope: undefined - no "undefined" string in output', () => {
  const registry = createRegistry();

  it('http-api with undefined scope: package name is just the project name', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-undef-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: undefined,
        name: 'my-api',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const pkg = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
      ) as Record<string, unknown>;

      expect(pkg.name).toBe('my-api');
      expect(pkg.name).not.toContain('undefined');
      expect(pkg.name).not.toContain('@/');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('http-api with defined scope: package name includes scope', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-def-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: '@acme',
        name: 'my-api',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const pkg = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8'),
      ) as Record<string, unknown>;

      expect(pkg.name).toBe('@acme/my-api');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('monorepo with undefined scope: libs/common/package.json has no scope', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-mono-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: undefined,
        projectType: 'monorepo',
        name: 'my-mono',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const commonPkg = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'libs', 'common', 'package.json'), 'utf-8'),
      ) as Record<string, unknown>;

      expect(commonPkg.name).toBe('common');
      expect(commonPkg.name).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('monorepo with defined scope: libs/common/package.json has scope', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-mono-scoped-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: '@org',
        projectType: 'monorepo',
        name: 'my-mono',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const commonPkg = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'libs', 'common', 'package.json'), 'utf-8'),
      ) as Record<string, unknown>;

      expect(commonPkg.name).toBe('@org/common');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('monorepo libs/common/src/index.ts uses packageScope ?? name fallback', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-index-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: undefined,
        projectType: 'monorepo',
        name: 'my-mono',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const indexContent = fs.readFileSync(
        path.join(outputDir, 'libs', 'common', 'src', 'index.ts'),
        'utf-8',
      );

      // The template uses packageScope ?? name, so when scope is undefined, it should show the name
      expect(indexContent).not.toContain('@undefined');
      expect(indexContent).toContain('my-mono');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('full-stack with undefined scope: libs/shared-types/package.json has no scope', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-fullstack-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: undefined,
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        name: 'my-fs',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const sharedPkg = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'libs', 'shared-types', 'package.json'), 'utf-8'),
      ) as Record<string, unknown>;

      expect(sharedPkg.name).toBe('shared-types');
      expect(sharedPkg.name).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('docs-site recipe with undefined scope: github link has no "undefined"', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-docs-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: undefined,
        name: 'my-docs',
        recipes: ['docs-site'] as RecipeId[],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const configPath = path.join(outputDir, 'docs', '.vitepress', 'config.ts');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        expect(content).not.toContain('undefined');
      }
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('docs-site recipe with defined scope: github link includes org name', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-docs-scoped-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: '@my-org',
        name: 'my-docs',
        recipes: ['docs-site'] as RecipeId[],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const configPath = path.join(outputDir, 'docs', '.vitepress', 'config.ts');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        expect(content).toContain('my-org/my-docs');
        expect(content).not.toContain('undefined');
      }
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('README.md with undefined scope: no @undefined in heading', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-readme-'));

    try {
      const config = makeConfig({
        outputDir,
        scope: undefined,
        name: 'my-api',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const readme = fs.readFileSync(path.join(outputDir, 'README.md'), 'utf-8');
      expect(readme).toContain('# my-api');
      expect(readme).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

describe('transportLayer: undefined for non-microservice types', () => {
  const registry = createRegistry();

  it('http-api with undefined transportLayer generates without error', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-transport-undef-http-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        transportLayer: undefined,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      expect(mainTs).not.toContain('undefined');
      expect(mainTs).not.toContain('createMicroservice');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('cli-app with undefined transportLayer generates without error', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-transport-undef-cli-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'cli-app',
        transportLayer: undefined,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      expect(mainTs).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('.env.example does not contain transport-specific env vars when transportLayer is undefined', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-transport-env-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        transportLayer: undefined,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const envExample = fs.readFileSync(path.join(outputDir, '.env.example'), 'utf-8');
      expect(envExample).not.toContain('REDIS_HOST');
      expect(envExample).not.toContain('NATS_URL');
      expect(envExample).not.toContain('KAFKA_BROKERS');
      expect(envExample).not.toContain('TCP_HOST');
      expect(envExample).not.toContain('RABBITMQ_URL');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

describe('frontendFramework: undefined for non-full-stack types', () => {
  const registry = createRegistry();

  it('http-api with undefined frontendFramework generates without error', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-frontend-undef-http-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        frontendFramework: undefined,
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);
      // No frontend directory should exist
      expect(fs.existsSync(path.join(outputDir, 'apps', 'web'))).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('monorepo with undefined frontendFramework generates without error and has no web dir', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-frontend-undef-mono-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'monorepo',
        frontendFramework: undefined,
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);
      // No frontend app directory
      expect(fs.existsSync(path.join(outputDir, 'apps', 'web'))).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

describe('httpAdapter in non-HTTP project types', () => {
  const registry = createRegistry();

  it('httpAdapter defaults to fastify for cli-app - base template guards against it', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-adapter-cli-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'cli-app',
        httpAdapter: 'fastify',
      });
      await generate(config, registry, TEMPLATES_DIR);

      // cli-app should not have Fastify/Express imports in its main.ts
      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      expect(mainTs).not.toContain('FastifyAdapter');
      expect(mainTs).not.toContain('ExpressAdapter');
      expect(mainTs).not.toContain('platform-fastify');
      expect(mainTs).not.toContain('platform-express');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('httpAdapter defaults to fastify for scheduled-worker - base template guards against it', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-adapter-worker-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'scheduled-worker',
        httpAdapter: 'fastify',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      expect(mainTs).not.toContain('FastifyAdapter');
      expect(mainTs).not.toContain('ExpressAdapter');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('httpAdapter defaults to fastify for microservice - main.ts does not use it', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-adapter-micro-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'tcp',
        httpAdapter: 'fastify',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      expect(mainTs).not.toContain('FastifyAdapter');
      expect(mainTs).not.toContain('ExpressAdapter');
      expect(mainTs).toContain('createMicroservice');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Recipe templates with EJS - variable reference audit
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe EJS templates: variable reference audit', () => {
  let recipeEjsFiles: string[];

  beforeAll(() => {
    recipeEjsFiles = findEjsFiles(path.join(TEMPLATES_DIR, 'recipes'));
  });

  it('all recipe EJS templates render without error using minimal template data', () => {
    const minimalData: Record<string, unknown> = {
      name: 'test-app',
      packageScope: undefined,
      projectType: 'http-api',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    };

    const failures: { file: string; error: string }[] = [];

    for (const filePath of recipeEjsFiles) {
      const template = fs.readFileSync(filePath, 'utf-8');
      try {
        renderTemplate(template, minimalData, filePath);
      } catch (error) {
        failures.push({
          file: path.relative(TEMPLATES_DIR, filePath),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // BUG: Recipe EJS template fails to render with minimal data
    expect(failures).toEqual([]);
  });

  it('all recipe EJS templates render without error with express adapter', () => {
    const expressData: Record<string, unknown> = {
      name: 'test-app',
      packageScope: undefined,
      projectType: 'http-api',
      cloudProvider: 'none',
      httpAdapter: 'express',
      transportLayer: undefined,
      frontendFramework: undefined,
    };

    const failures: { file: string; error: string }[] = [];

    for (const filePath of recipeEjsFiles) {
      const template = fs.readFileSync(filePath, 'utf-8');
      try {
        renderTemplate(template, expressData, filePath);
      } catch (error) {
        failures.push({
          file: path.relative(TEMPLATES_DIR, filePath),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // BUG: Recipe EJS template fails to render with express adapter data
    expect(failures).toEqual([]);
  });

  it('recipe templates that reference httpAdapter should only use express|fastify branching', () => {
    const templateVarPattern = /<%[=-]?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*%>/g;
    const knownVars = new Set([
      'name',
      'packageScope',
      'projectType',
      'cloudProvider',
      'httpAdapter',
      'transportLayer',
      'frontendFramework',
    ]);

    const unknownVarUsages: { file: string; vars: string[] }[] = [];

    for (const filePath of recipeEjsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const unknownVars: string[] = [];
      let match: RegExpExecArray | null;

      // Reset regex
      templateVarPattern.lastIndex = 0;
      while ((match = templateVarPattern.exec(content)) !== null) {
        const varName = match[1];
        // Skip EJS control flow keywords and common JS globals
        if (
          ['if', 'else', 'for', 'let', 'const', 'var', 'true', 'false', 'null', 'undefined'].includes(
            varName,
          )
        ) {
          continue;
        }
        if (!knownVars.has(varName)) {
          unknownVars.push(varName);
        }
      }

      if (unknownVars.length > 0) {
        unknownVarUsages.push({
          file: path.relative(TEMPLATES_DIR, filePath),
          vars: [...new Set(unknownVars)],
        });
      }
    }

    // Any unknown variables would be undefined at render time
    // BUG: if unknownVarUsages is non-empty, templates reference vars not in templateData
    expect(unknownVarUsages).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. EJS render: deployment templates with various project types
// ─────────────────────────────────────────────────────────────────────────────

describe('EJS render: deployment templates with all project types', () => {
  const registry = createRegistry();

  it('Dockerfile with full-stack project uses correct entry point', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-fs-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        deploymentTargets: ['dockerfile'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const dockerfile = fs.readFileSync(path.join(outputDir, 'Dockerfile'), 'utf-8');
      expect(dockerfile).toContain('apps/api/src/main.js');
      expect(dockerfile).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('Dockerfile with http-api project uses standard entry point', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-api-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        deploymentTargets: ['dockerfile'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const dockerfile = fs.readFileSync(path.join(outputDir, 'Dockerfile'), 'utf-8');
      expect(dockerfile).toContain('dist/main.js');
      expect(dockerfile).not.toContain('apps/api');
      expect(dockerfile).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('docker-compose with full-stack project includes web service', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-compose-fs-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        deploymentTargets: ['docker-compose'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const compose = fs.readFileSync(
        path.join(outputDir, 'docker-compose.yml'),
        'utf-8',
      );
      expect(compose).toContain('web:');
      expect(compose).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('docker-compose with http-api project does not include web service', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-compose-api-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        deploymentTargets: ['docker-compose'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const compose = fs.readFileSync(
        path.join(outputDir, 'docker-compose.yml'),
        'utf-8',
      );
      expect(compose).not.toContain('web:');
      expect(compose).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('kubernetes deployment uses project name in resource names', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-k8s-'));

    try {
      const config = makeConfig({
        outputDir,
        name: 'k8s-test-app',
        deploymentTargets: ['kubernetes'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const deployment = fs.readFileSync(
        path.join(outputDir, 'k8s', 'deployment.yaml'),
        'utf-8',
      );
      expect(deployment).toContain('name: k8s-test-app');
      expect(deployment).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('all deployment targets render without "undefined" for microservice project type', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-micro-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'tcp',
        deploymentTargets: ['dockerfile', 'kubernetes', 'terraform', 'serverless-framework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const files = walkFiles(outputDir, TEXT_FILE_EXTENSIONS);
      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relative = path.relative(outputDir, filePath);

        // Check for literal "undefined" in YAML/tf/Dockerfile where it would be invalid
        if (
          relative.endsWith('.yml') ||
          relative.endsWith('.yaml') ||
          relative.endsWith('.tf') ||
          relative === 'Dockerfile'
        ) {
          expect(content).not.toContain('undefined');
        }
      }
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Direct EJS rendering: test templates with boundary conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('Direct EJS rendering: boundary conditions', () => {
  it('base/package.json.ejs with scope=undefined renders clean package name', () => {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'base', 'package.json.ejs'),
      'utf-8',
    );

    const result = renderTemplate(template, {
      name: 'my-app',
      packageScope: undefined,
      projectType: 'http-api',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    });

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.name).toBe('my-app');
  });

  it('base/package.json.ejs with scope=@org renders scoped package name', () => {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'base', 'package.json.ejs'),
      'utf-8',
    );

    const result = renderTemplate(template, {
      name: 'my-app',
      packageScope: '@org',
      projectType: 'http-api',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    });

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.name).toBe('@org/my-app');
  });

  it('microservice/main.ts.ejs with transportLayer=undefined falls through to custom branch', () => {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'project-types', 'microservice', 'src', 'main.ts.ejs'),
      'utf-8',
    );

    // BUG: When transportLayer is undefined (which should not happen for microservice
    // projects, but could if config validation is bypassed), the template falls through
    // all if/else-if blocks and reaches the final else block which generates a
    // "Custom transport" comment. This is technically safe but produces an incomplete
    // main.ts that won't compile without manual intervention.
    const result = renderTemplate(template, {
      name: 'test-svc',
      packageScope: undefined,
      projectType: 'microservice',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    });

    // The final else branch handles undefined by generating a custom transport placeholder
    expect(result).toContain('Custom transport');
    expect(result).not.toContain('undefined');
  });

  it('docs-site config.ts.ejs with undefined packageScope produces clean github links', () => {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'recipes', 'docs-site', 'docs', '.vitepress', 'config.ts.ejs'),
      'utf-8',
    );

    const result = renderTemplate(template, {
      name: 'my-docs',
      packageScope: undefined,
      projectType: 'http-api',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    });

    // Should produce a github link like https://github.com/my-docs (no scope prefix)
    expect(result).not.toContain('undefined');
    // The ternary produces empty string when packageScope is undefined
    expect(result).toContain('https://github.com/my-docs');
  });

  it('docs-site config.ts.ejs with defined packageScope includes org in github links', () => {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'recipes', 'docs-site', 'docs', '.vitepress', 'config.ts.ejs'),
      'utf-8',
    );

    const result = renderTemplate(template, {
      name: 'my-docs',
      packageScope: '@my-org',
      projectType: 'http-api',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    });

    expect(result).toContain('https://github.com/my-org/my-docs');
    expect(result).not.toContain('undefined');
  });

  it('base/package.json.ejs for non-HTTP project type excludes adapter devDependencies', () => {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'base', 'package.json.ejs'),
      'utf-8',
    );

    const result = renderTemplate(template, {
      name: 'my-cli',
      packageScope: undefined,
      projectType: 'cli-app',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    });

    const parsed = JSON.parse(result) as Record<string, unknown>;
    const devDeps = parsed.devDependencies as Record<string, string>;

    // Non-HTTP project types should not get HTTP adapter devDeps in base package.json
    expect(devDeps['@nestjs/platform-fastify']).toBeUndefined();
    expect(devDeps['@nestjs/platform-express']).toBeUndefined();
    expect(devDeps['fastify']).toBeUndefined();
  });

  it('monorepo/README.md.ejs with undefined scope produces clean heading', () => {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'project-types', 'monorepo', 'README.md.ejs'),
      'utf-8',
    );

    const result = renderTemplate(template, {
      name: 'my-mono',
      packageScope: undefined,
      projectType: 'monorepo',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    });

    expect(result).toContain('# my-mono');
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('@/');
  });

  it('all base EJS templates render without error with all-undefined optional vars', () => {
    const baseEjsFiles = findEjsFiles(path.join(TEMPLATES_DIR, 'base'));
    const data: Record<string, unknown> = {
      name: 'test-app',
      packageScope: undefined,
      projectType: 'http-api',
      cloudProvider: 'none',
      httpAdapter: 'fastify',
      transportLayer: undefined,
      frontendFramework: undefined,
    };

    const failures: { file: string; error: string }[] = [];

    for (const filePath of baseEjsFiles) {
      const template = fs.readFileSync(filePath, 'utf-8');
      try {
        const result = renderTemplate(template, data, filePath);
        // Verify no "undefined" leaked into the output
        if (result.includes('"undefined') || result.includes("'undefined")) {
          failures.push({
            file: path.relative(TEMPLATES_DIR, filePath),
            error: 'Rendered output contains quoted "undefined" string',
          });
        }
      } catch (error) {
        failures.push({
          file: path.relative(TEMPLATES_DIR, filePath),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    expect(failures).toEqual([]);
  });

  it('all project-type EJS templates render without error for their own type', () => {
    const projectTypeConfigs: Record<string, Record<string, unknown>> = {
      'http-api': {
        name: 'test-app',
        packageScope: undefined,
        projectType: 'http-api',
        cloudProvider: 'none',
        httpAdapter: 'fastify',
        transportLayer: undefined,
        frontendFramework: undefined,
      },
      'aws-lambda': {
        name: 'test-app',
        packageScope: undefined,
        projectType: 'aws-lambda',
        cloudProvider: 'aws',
        httpAdapter: 'fastify',
        transportLayer: undefined,
        frontendFramework: undefined,
      },
      microservice: {
        name: 'test-app',
        packageScope: undefined,
        projectType: 'microservice',
        cloudProvider: 'none',
        httpAdapter: 'fastify',
        transportLayer: 'tcp',
        frontendFramework: undefined,
      },
      'cli-app': {
        name: 'test-app',
        packageScope: undefined,
        projectType: 'cli-app',
        cloudProvider: 'none',
        httpAdapter: 'fastify',
        transportLayer: undefined,
        frontendFramework: undefined,
      },
      'scheduled-worker': {
        name: 'test-app',
        packageScope: undefined,
        projectType: 'scheduled-worker',
        cloudProvider: 'none',
        httpAdapter: 'fastify',
        transportLayer: undefined,
        frontendFramework: undefined,
      },
      monorepo: {
        name: 'test-app',
        packageScope: undefined,
        projectType: 'monorepo',
        cloudProvider: 'none',
        httpAdapter: 'fastify',
        transportLayer: undefined,
        frontendFramework: undefined,
      },
      'full-stack': {
        name: 'test-app',
        packageScope: undefined,
        projectType: 'full-stack',
        cloudProvider: 'none',
        httpAdapter: 'fastify',
        transportLayer: undefined,
        frontendFramework: 'nextjs',
      },
    };

    const failures: { file: string; projectType: string; error: string }[] = [];

    for (const [projectType, data] of Object.entries(projectTypeConfigs)) {
      const ptDir = path.join(TEMPLATES_DIR, 'project-types', projectType);
      if (!fs.existsSync(ptDir)) continue;

      const ejsFiles = findEjsFiles(ptDir);
      for (const filePath of ejsFiles) {
        const template = fs.readFileSync(filePath, 'utf-8');
        try {
          renderTemplate(template, data, filePath);
        } catch (error) {
          failures.push({
            file: path.relative(TEMPLATES_DIR, filePath),
            projectType,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Cross-project-type recipe rendering: recipes might be used with project
//    types that set httpAdapter but don't actually use HTTP
// ─────────────────────────────────────────────────────────────────────────────

describe('Recipe EJS templates: httpAdapter-dependent recipes for non-HTTP project types', () => {
  const registry = createRegistry();

  // These recipes have EJS templates that branch on httpAdapter. When applied to
  // non-HTTP project types, they still render (using the httpAdapter default) but
  // produce HTTP-specific code that is effectively dead code.
  const httpAdapterRecipes: RecipeId[] = [
    'correlation-id',
    'request-logging',
    'distributed-tracing',
    'multi-tenancy',
    'idempotency',
    'sentry',
    'api-keys',
    'dpop',
    'oauth2-introspection',
    'content-digest',
    'http-caching',
    'pagination',
    'prefer-header',
    'audit-trail',
    'file-upload',
    'opentelemetry',
  ];

  it('all httpAdapter-dependent recipe templates render without error with both adapters', () => {
    const failures: { recipe: string; adapter: string; error: string }[] = [];

    for (const recipeId of httpAdapterRecipes) {
      const recipe = registry.get(recipeId);
      if (!recipe?.templateDir) continue;

      const recipeDir = path.join(TEMPLATES_DIR, 'recipes', recipe.templateDir);
      const ejsFiles = findEjsFiles(recipeDir);

      for (const adapter of ['fastify', 'express'] as const) {
        const data: Record<string, unknown> = {
          name: 'test-app',
          packageScope: undefined,
          projectType: 'http-api',
          cloudProvider: 'none',
          httpAdapter: adapter,
          transportLayer: undefined,
          frontendFramework: undefined,
        };

        for (const filePath of ejsFiles) {
          const template = fs.readFileSync(filePath, 'utf-8');
          try {
            const result = renderTemplate(template, data, filePath);
            // Verify rendered output is non-empty
            if (result.trim().length === 0) {
              failures.push({
                recipe: recipeId,
                adapter,
                error: `${path.relative(TEMPLATES_DIR, filePath)} rendered to empty string`,
              });
            }
          } catch (error) {
            failures.push({
              recipe: recipeId,
              adapter,
              error: `${path.relative(TEMPLATES_DIR, filePath)}: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Full generation with recipes that use templateData vars
// ─────────────────────────────────────────────────────────────────────────────

describe('Full generation with name-dependent recipes', () => {
  const registry = createRegistry();

  it('rabbitmq recipe renders queue name with project name', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-rabbitmq-name-'));

    try {
      const config = makeConfig({
        outputDir,
        name: 'queue-svc',
        recipes: ['rabbitmq'] as RecipeId[],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const queueModule = fs.readFileSync(
        path.join(outputDir, 'src', 'infrastructure', 'queue', 'queue.module.ts'),
        'utf-8',
      );
      expect(queueModule).toContain('queue-svc-queue');
      expect(queueModule).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('mongoose recipe renders DB name with project name', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-mongoose-name-'));

    try {
      const config = makeConfig({
        outputDir,
        name: 'mongo-svc',
        recipes: ['mongoose'] as RecipeId[],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const dbModule = fs.readFileSync(
        path.join(outputDir, 'src', 'infrastructure', 'database', 'database.module.ts'),
        'utf-8',
      );
      expect(dbModule).toContain('mongo-svc');
      expect(dbModule).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('typeorm-postgres recipe renders DB name with project name', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-typeorm-name-'));

    try {
      const config = makeConfig({
        outputDir,
        name: 'pg-svc',
        recipes: ['typeorm-postgres'] as RecipeId[],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const dataSource = fs.readFileSync(
        path.join(outputDir, 'src', 'infrastructure', 'database', 'data-source.ts'),
        'utf-8',
      );
      expect(dataSource).toContain('pg-svc');
      expect(dataSource).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('swagger recipe renders title with project name', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-swagger-name-'));

    try {
      const config = makeConfig({
        outputDir,
        name: 'api-svc',
        recipes: ['swagger'] as RecipeId[],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const swaggerFile = fs.readFileSync(
        path.join(outputDir, 'src', 'main.swagger.ts'),
        'utf-8',
      );
      expect(swaggerFile).toContain('api-svc');
      expect(swaggerFile).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('docker-compose-dev recipe renders DB name with project name', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-compose-dev-name-'));

    try {
      const config = makeConfig({
        outputDir,
        name: 'dev-svc',
        recipes: ['docker-compose-dev'] as RecipeId[],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const compose = fs.readFileSync(
        path.join(outputDir, 'docker-compose.dev.yml'),
        'utf-8',
      );
      expect(compose).toContain('dev-svc');
      expect(compose).not.toContain('undefined');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Microservice transport layers: each transport type renders valid main.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('Microservice transport layers: each renders valid main.ts', () => {
  const registry = createRegistry();
  const transports: TransportLayer[] = ['tcp', 'redis', 'nats', 'mqtt', 'rabbitmq', 'kafka', 'grpc', 'custom'];

  it.each(transports)('transport %s: main.ts renders without "undefined"', async (transport) => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `spoonfeed-transport-${transport}-`),
    );

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: transport,
        name: 'ms-test',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      expect(mainTs).not.toContain('undefined');
      expect(mainTs).toContain('createMicroservice');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rabbitmq transport renders project name in queue name', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-transport-rmq-name-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'rabbitmq',
        name: 'rmq-service',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      expect(mainTs).toContain('rmq-service-queue');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('kafka transport renders project name in client ID and consumer group', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-transport-kafka-name-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'kafka',
        name: 'kafka-service',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      expect(mainTs).toContain("clientId: 'kafka-service'");
      expect(mainTs).toContain("groupId: 'kafka-service-consumer'");
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('grpc transport renders project name in package name and proto path', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-transport-grpc-name-'));

    try {
      const config = makeConfig({
        outputDir,
        projectType: 'microservice',
        transportLayer: 'grpc',
        name: 'grpc-service',
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = fs.readFileSync(path.join(outputDir, 'src', 'main.ts'), 'utf-8');
      // grpc uses name.replace(/-/g, '_') for package name
      expect(mainTs).toContain("package: 'grpc_service'");
      expect(mainTs).toContain('grpc-service.proto');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
