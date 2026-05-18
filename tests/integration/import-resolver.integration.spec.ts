import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig } from '@spoonfeed/types';

// Suppress @clack/prompts spinner output in tests
jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

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

/**
 * Recursively collect all `.ts` files under `dir`, skipping node_modules.
 */
function walkTsFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Walk all `.ts` files under `dir` and extract external package imports.
 * Returns a map from package name to the list of files that import it.
 *
 * Skips:
 *  - relative imports (starting with `.`)
 *  - path-alias imports (starting with `@/`)
 *  - Node.js built-in imports (`node:*`)
 */
function extractExternalImports(dir: string): Map<string, string[]> {
  const importMap = new Map<string, string[]>();
  const tsFiles = walkTsFiles(dir);

  // Matches: import ... from 'xxx'  /  import 'xxx'  /  import type ... from 'xxx'
  const importRegex = /import\s+(?:type\s+)?(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;

  for (const filePath of tsFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      const specifier = match[1];

      // Skip relative imports
      if (specifier.startsWith('.')) continue;

      // Skip path-alias imports (@/ prefix)
      if (specifier.startsWith('@/')) continue;

      // Skip Node.js built-in modules
      if (specifier.startsWith('node:')) continue;

      // Resolve the package name (handle scoped packages)
      let packageName: string;
      if (specifier.startsWith('@')) {
        // Scoped: @scope/name or @scope/name/deep/path -> @scope/name
        const parts = specifier.split('/');
        packageName = `${parts[0]}/${parts[1]}`;
      } else {
        // Unscoped: name or name/deep/path -> name
        packageName = specifier.split('/')[0];
      }

      const files = importMap.get(packageName) ?? [];
      const relativePath = path.relative(dir, filePath);
      if (!files.includes(relativePath)) {
        files.push(relativePath);
      }
      importMap.set(packageName, files);
    }
  }

  return importMap;
}

/**
 * Read `package.json` from `dir` and return all declared dependency names
 * (both `dependencies` and `devDependencies`).
 */
function getDeclaredDeps(dir: string): Set<string> {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
  const deps = Object.keys((pkg.dependencies ?? {}) as Record<string, string>);
  const devDeps = Object.keys((pkg.devDependencies ?? {}) as Record<string, string>);
  return new Set([...deps, ...devDeps]);
}

interface TestScenario {
  label: string;
  config: Partial<ProjectConfig>;
  /** Directory within the output to scan for .ts files (relative to outputDir) */
  srcDir: string;
}

const scenarios: TestScenario[] = [
  {
    label: 'http-api + fastify + [swagger, pino, jwt-auth, helmet, typeorm-postgres]',
    config: {
      projectType: 'http-api',
      httpAdapter: 'fastify',
      recipes: ['swagger', 'pino', 'jwt-auth', 'helmet', 'typeorm-postgres'],
    },
    srcDir: '.',
  },
  {
    label: 'http-api + express + [swagger, pino, jwt-auth, helmet, typeorm-postgres]',
    config: {
      projectType: 'http-api',
      httpAdapter: 'express',
      recipes: ['swagger', 'pino', 'jwt-auth', 'helmet', 'typeorm-postgres'],
    },
    srcDir: '.',
  },
  {
    label: 'aws-lambda + express + [swagger, pino, opentelemetry]',
    config: {
      projectType: 'aws-lambda',
      httpAdapter: 'express',
      recipes: ['swagger', 'pino', 'opentelemetry'],
    },
    srcDir: '.',
  },
  {
    label: 'full-stack + express + nextjs + [swagger, pino, jwt-auth]',
    config: {
      projectType: 'full-stack',
      httpAdapter: 'express',
      frontendFramework: 'nextjs',
      recipes: ['swagger', 'pino', 'jwt-auth'],
    },
    srcDir: 'apps/api',
  },
];

describe('Import Resolver: every import resolves to a declared dependency', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-import-test-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  describe.each(scenarios)('$label', ({ config, srcDir }) => {
    it('all external imports have matching package.json dependencies', async () => {
      const fullConfig = makeConfig({ ...config, outputDir });
      await generate(fullConfig, registry, TEMPLATES_DIR);

      const scanDir = path.join(outputDir, srcDir);
      const importMap = extractExternalImports(scanDir);
      const declaredDeps = getDeclaredDeps(outputDir);

      const missing: Array<{ pkg: string; files: string[] }> = [];

      for (const [pkg, files] of importMap) {
        // Check direct dependency, or @types/<pkg> (DefinitelyTyped pattern)
        const typesName = pkg.startsWith('@')
          ? `@types/${pkg.slice(1).replace('/', '__')}`
          : `@types/${pkg}`;

        if (!declaredDeps.has(pkg) && !declaredDeps.has(typesName)) {
          missing.push({ pkg, files });
        }
      }

      if (missing.length > 0) {
        const report = missing
          .map(({ pkg, files }) => `  "${pkg}" imported by:\n${files.map((f) => `    - ${f}`).join('\n')}`)
          .join('\n');

        throw new Error(
          `Found ${missing.length} package(s) imported but not declared in package.json:\n${report}`,
        );
      }
    });
  });
});
