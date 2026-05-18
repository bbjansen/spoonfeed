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
 * Recursively collect all file paths under `dir`, relative to `base`.
 * Skips node_modules.
 */
function collectFiles(dir: string, base: string): string[] {
  if (!fs.existsSync(dir)) return [];
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

// Recipes that add src/ and tests/ files, have mainTsSetup, and are compatible
// with monorepo/full-stack project types.
const RECIPES_WITH_SRC_FILES: RecipeId[] = [
  'jwt-auth',
  'health-checks',
  'correlation-id',
  'pino',
  'swagger',
];

// Recipes that have mainTsSetup blocks (they insert code into main.ts)
const RECIPES_WITH_MAIN_TS_BLOCKS: RecipeId[] = ['swagger', 'helmet'];

describe('Monorepo relocation: no orphaned root src/ or tests/', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-relocation-${projectType}-`));
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('should not have a root src/ directory after generation', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: [...RECIPES_WITH_SRC_FILES],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'src')).toBe(false);
    });

    it('should not have a root tests/ directory after generation', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: [...RECIPES_WITH_SRC_FILES],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'tests')).toBe(false);
    });

    it('should have all base source files under apps/api/src/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const expectedApiSrcFiles = [
        'apps/api/src/main.ts',
        'apps/api/src/app.module.ts',
        'apps/api/src/shared/filters/http-exception.filter.ts',
        'apps/api/src/shared/interceptors/response.interceptor.ts',
        'apps/api/src/shared/constants/error-codes.constant.ts',
        'apps/api/src/shared/constants/http.constant.ts',
        'apps/api/src/shared/constants/index.ts',
        'apps/api/src/shared/errors/application.error.ts',
        'apps/api/src/shared/errors/forbidden.error.ts',
        'apps/api/src/shared/errors/index.ts',
        'apps/api/src/shared/errors/invalid-request.error.ts',
        'apps/api/src/shared/errors/not-found.error.ts',
        'apps/api/src/shared/errors/requester.error.ts',
        'apps/api/src/shared/errors/validation.error.ts',
        'apps/api/src/shared/pipes/parse-uuid.pipe.ts',
        'apps/api/src/shared/utils/index.ts',
        'apps/api/src/shared/utils/retry.util.ts',
        'apps/api/src/shared/utils/sleep.util.ts',
      ];

      for (const file of expectedApiSrcFiles) {
        expect(fileExists(outputDir, file)).toBe(true);
      }
    });

    it('should have all base test files under apps/api/tests/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const expectedApiTestFiles = [
        'apps/api/tests/e2e/app.e2e-spec.ts',
        'apps/api/tests/unit/app.module.spec.ts',
        'apps/api/tests/unit/shared/errors/error-hierarchy.spec.ts',
        'apps/api/tests/unit/shared/filters/http-exception.filter.spec.ts',
        'apps/api/tests/unit/shared/interceptors/response.interceptor.spec.ts',
        'apps/api/tests/unit/shared/pipes/parse-uuid.pipe.spec.ts',
      ];

      for (const file of expectedApiTestFiles) {
        expect(fileExists(outputDir, file)).toBe(true);
      }
    });
  });
});

describe('Monorepo relocation: recipe files land under apps/api/', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-recipe-reloc-${projectType}-`));
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('jwt-auth recipe files should be under apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['jwt-auth'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'apps/api/src/shared/guards/jwt-auth.guard.ts')).toBe(true);
      expect(fileExists(outputDir, 'apps/api/src/shared/decorators/current-user.decorator.ts')).toBe(
        true,
      );
      expect(fileExists(outputDir, 'apps/api/src/shared/decorators/public.decorator.ts')).toBe(true);
      expect(
        fileExists(outputDir, 'apps/api/tests/unit/shared/guards/jwt-auth.guard.spec.ts'),
      ).toBe(true);

      // Recipe files should NOT exist at root
      expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(false);
      expect(fileExists(outputDir, 'tests/unit/shared/guards/jwt-auth.guard.spec.ts')).toBe(false);
    });

    it('pino recipe files should be under apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['pino'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(
        fileExists(outputDir, 'apps/api/src/infrastructure/logging/logger.module.ts'),
      ).toBe(true);
      expect(
        fileExists(outputDir, 'apps/api/tests/unit/infrastructure/logging/logger.module.spec.ts'),
      ).toBe(true);

      // Recipe files should NOT exist at root
      expect(fileExists(outputDir, 'src/infrastructure/logging/logger.module.ts')).toBe(false);
    });

    it('health-checks recipe files should be under apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['health-checks'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(
        fileExists(outputDir, 'apps/api/src/shared/health/health.controller.ts'),
      ).toBe(true);
      expect(
        fileExists(outputDir, 'apps/api/src/shared/health/health.module.ts'),
      ).toBe(true);
      expect(
        fileExists(outputDir, 'apps/api/tests/unit/shared/health/health.controller.spec.ts'),
      ).toBe(true);
    });

    it('correlation-id recipe files should be under apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['correlation-id'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(
        fileExists(
          outputDir,
          'apps/api/src/shared/middleware/correlation-id.middleware.ts',
        ),
      ).toBe(true);
      expect(
        fileExists(
          outputDir,
          'apps/api/tests/unit/shared/middleware/correlation-id.spec.ts',
        ),
      ).toBe(true);
    });

    it('multiple recipes all land under apps/api/ with no root src/ or tests/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: [...RECIPES_WITH_SRC_FILES],
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Root src/ and tests/ must not exist
      expect(fileExists(outputDir, 'src')).toBe(false);
      expect(fileExists(outputDir, 'tests')).toBe(false);

      // All recipe src files must be under apps/api/
      const allFiles = collectFiles(outputDir, outputDir);
      const srcFiles = allFiles.filter(
        (f) => f.startsWith('src/') || f.startsWith('tests/'),
      );
      expect(srcFiles).toEqual([]);
    });
  });
});

describe('Monorepo relocation: recipe src/ files do not collide with base files', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-collision-${projectType}-`),
      );
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('base shared/guards/.gitkeep and jwt-auth guard coexist under apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['jwt-auth'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Base .gitkeep should exist
      expect(fileExists(outputDir, 'apps/api/src/shared/guards/.gitkeep')).toBe(true);
      // Recipe guard should also exist
      expect(fileExists(outputDir, 'apps/api/src/shared/guards/jwt-auth.guard.ts')).toBe(true);
    });

    it('base shared/interceptors/response.interceptor.ts is not overwritten by recipe interceptors', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['health-checks', 'pino'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Base response interceptor must exist and contain actual content
      const responseInterceptor = readFile(
        outputDir,
        'apps/api/src/shared/interceptors/response.interceptor.ts',
      );
      expect(responseInterceptor).toContain('ResponseInterceptor');
    });

    it('base shared/decorators/.gitkeep and jwt-auth decorators coexist', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['jwt-auth'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'apps/api/src/shared/decorators/.gitkeep')).toBe(true);
      expect(
        fileExists(outputDir, 'apps/api/src/shared/decorators/current-user.decorator.ts'),
      ).toBe(true);
      expect(
        fileExists(outputDir, 'apps/api/src/shared/decorators/public.decorator.ts'),
      ).toBe(true);
    });
  });
});

describe('Monorepo relocation: main.ts blocks inserted into correct file', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-mainTs-${projectType}-`),
      );
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('swagger recipe main.ts block is inserted into apps/api/src/main.ts', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['swagger'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'apps/api/src/main.ts');
      expect(mainTs).toContain('SwaggerModule');
      expect(mainTs).toContain('DocumentBuilder');

      // There should be no root src/main.ts
      expect(fileExists(outputDir, 'src/main.ts')).toBe(false);
    });

    it('helmet recipe main.ts block is inserted into apps/api/src/main.ts', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['helmet'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'apps/api/src/main.ts');
      expect(mainTs).toContain('helmet');

      expect(fileExists(outputDir, 'src/main.ts')).toBe(false);
    });

    it('recipe without mainTsSetup does not create root src/main.ts', async () => {
      // The cors recipe has no mainTsSetup, but we verify it doesn't break
      // the relocation by accidentally creating a root src/main.ts
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['cors'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'src/main.ts')).toBe(false);
      expect(fileExists(outputDir, 'apps/api/src/main.ts')).toBe(true);
    });

    it('multiple recipes with main.ts blocks all insert into apps/api/src/main.ts', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['swagger', 'helmet'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'apps/api/src/main.ts');
      expect(mainTs).toContain('SwaggerModule');
      expect(mainTs).toContain('helmet');

      expect(fileExists(outputDir, 'src/main.ts')).toBe(false);
    });
  });
});

describe('Monorepo relocation: .env.example stays at root', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-env-${projectType}-`));
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('.env.example should be at project root, not under apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['typeorm-postgres'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, '.env.example')).toBe(true);
      expect(fileExists(outputDir, 'apps/api/.env.example')).toBe(false);
    });

    it('.env.example at root contains recipe env vars', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['typeorm-postgres'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const envContent = readFile(outputDir, '.env.example');
      expect(envContent).toContain('PORT');
      expect(envContent).toContain('NODE_ENV');
      expect(envContent).toContain('DB_HOST');
      expect(envContent).toContain('DB_PORT');
    });
  });
});

describe('Monorepo relocation: test files in correct location and jest config alignment', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-tests-${projectType}-`));
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('recipe test files land under apps/api/tests/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['jwt-auth', 'pino', 'health-checks'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      // jwt-auth test
      expect(
        fileExists(outputDir, 'apps/api/tests/unit/shared/guards/jwt-auth.guard.spec.ts'),
      ).toBe(true);
      // pino test
      expect(
        fileExists(
          outputDir,
          'apps/api/tests/unit/infrastructure/logging/logger.module.spec.ts',
        ),
      ).toBe(true);
      // health-checks test
      expect(
        fileExists(
          outputDir,
          'apps/api/tests/unit/shared/health/health.controller.spec.ts',
        ),
      ).toBe(true);

      // None at root
      expect(fileExists(outputDir, 'tests')).toBe(false);
    });

    it('jest.config.ts unit test pattern matches apps/api/tests/unit/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const jestConfig = readFile(outputDir, 'jest.config.ts');
      expect(jestConfig).toContain('<rootDir>/apps/api/tests/unit');
    });

    it('jest.config.ts integration test pattern matches apps/api/tests/integration/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const jestConfig = readFile(outputDir, 'jest.config.ts');
      expect(jestConfig).toContain('<rootDir>/apps/api/tests/integration');
    });

    it('jest.config.ts e2e test pattern matches apps/api/tests/e2e/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const jestConfig = readFile(outputDir, 'jest.config.ts');
      expect(jestConfig).toContain('<rootDir>/apps/api/tests/e2e');
    });

    it('jest.config.ts moduleNameMapper @/* points to apps/api/src/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const jestConfig = readFile(outputDir, 'jest.config.ts');
      expect(jestConfig).toContain('<rootDir>/apps/api/src/$1');
    });

    it('jest.config.ts collectCoverageFrom points to apps/api/src/', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const jestConfig = readFile(outputDir, 'jest.config.ts');
      expect(jestConfig).toContain("'apps/api/src/");
      // Should NOT reference bare 'src/' in collectCoverageFrom
      expect(jestConfig).not.toMatch(/collectCoverageFrom:\s*\['src\//);
    });
  });
});

describe('Monorepo relocation: nest-cli.json configuration', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-nestcli-${projectType}-`));
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('nest-cli.json sourceRoot points to apps/api/src', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const nestCli = readJson(outputDir, 'nest-cli.json');
      expect(nestCli.sourceRoot).toBe('apps/api/src');
    });

    it('nest-cli.json entryFile points to apps/api/src/main', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const nestCli = readJson(outputDir, 'nest-cli.json');
      expect(nestCli.entryFile).toBe('apps/api/src/main');
    });
  });
});

describe('Monorepo relocation: tsconfig.json paths', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-tsconfig-${projectType}-`));
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('tsconfig.json @/* paths point to apps/api/src/*', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const tsConfig = readJson(outputDir, 'tsconfig.json');
      const compilerOptions = tsConfig.compilerOptions as Record<string, unknown>;
      const paths = compilerOptions.paths as Record<string, string[]>;
      expect(paths['@/*']).toEqual(['apps/api/src/*']);
    });
  });
});

describe('Full-stack relocation: frontend files stay in apps/web/', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(['nextjs', 'vite-react', 'nuxt', 'sveltekit'] as const)(
    'full-stack with %s frontend',
    (frontendFramework) => {
      let outputDir: string;

      beforeEach(() => {
        outputDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-frontend-${frontendFramework}-`),
        );
      });

      afterEach(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('frontend files exist under apps/web/', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          frontendFramework,
          recipes: ['jwt-auth', 'swagger'],
        });
        await generate(config, registry, TEMPLATES_DIR);

        expect(fileExists(outputDir, 'apps/web')).toBe(true);

        // apps/web should have a package.json
        expect(fileExists(outputDir, 'apps/web/package.json')).toBe(true);
      });

      it('frontend files are NOT relocated to apps/api/', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          frontendFramework,
          recipes: ['jwt-auth'],
        });
        await generate(config, registry, TEMPLATES_DIR);

        // Collect all files under apps/api/
        const apiFiles = collectFiles(path.join(outputDir, 'apps', 'api'), outputDir);

        // No frontend-specific files should be under apps/api/
        const frontendExtensions = ['.tsx', '.jsx', '.vue', '.svelte'];
        // Only check for framework-specific files that would indicate relocation.
        // apps/api/ may contain .ts files but should not contain frontend components.
        const frontendFilesInApi = apiFiles.filter((f) => {
          const ext = path.extname(f);
          return frontendExtensions.includes(ext);
        });

        expect(frontendFilesInApi).toEqual([]);
      });

      it('apps/web/ files are distinct from apps/api/ files', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          frontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        const webFiles = collectFiles(
          path.join(outputDir, 'apps', 'web'),
          path.join(outputDir, 'apps', 'web'),
        );
        const apiFiles = collectFiles(
          path.join(outputDir, 'apps', 'api'),
          path.join(outputDir, 'apps', 'api'),
        );

        // The web and api directories should not share any files by name
        // (except possibly package.json which is expected in both)
        const sharedFiles = webFiles.filter(
          (f) => apiFiles.includes(f) && f !== 'package.json',
        );

        // tsconfig.json might legitimately exist in both; filter it out too
        const unexpectedShared = sharedFiles.filter(
          (f) => f !== 'tsconfig.json' && f !== 'CLAUDE.md',
        );
        expect(unexpectedShared).toEqual([]);
      });
    },
  );
});

describe('Monorepo relocation: combined recipe combos', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-combo-${projectType}-`),
      );
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('large recipe combo: no orphaned files, all under apps/api/', async () => {
      const recipes: RecipeId[] = [
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

      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes,
      });
      await generate(config, registry, TEMPLATES_DIR);

      // No root src/ or tests/
      expect(fileExists(outputDir, 'src')).toBe(false);
      expect(fileExists(outputDir, 'tests')).toBe(false);

      // All source files under apps/api/
      const allFiles = collectFiles(outputDir, outputDir);
      const orphanedSrcFiles = allFiles.filter(
        (f) => f.startsWith('src/') || f.startsWith('tests/'),
      );
      expect(orphanedSrcFiles).toEqual([]);

      // apps/api/src/main.ts should have recipe blocks
      const mainTs = readFile(outputDir, 'apps/api/src/main.ts');
      expect(mainTs).toContain('SwaggerModule');
      expect(mainTs).toContain('helmet');
    });

    it('recipe with Express adapter: all files correctly placed', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        httpAdapter: 'express',
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['swagger', 'jwt-auth', 'helmet', 'cors'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      // No root src/ or tests/
      expect(fileExists(outputDir, 'src')).toBe(false);
      expect(fileExists(outputDir, 'tests')).toBe(false);

      // main.ts should use Express patterns
      const mainTs = readFile(outputDir, 'apps/api/src/main.ts');
      expect(mainTs).toContain('NestFactory.create(AppModule)');
      expect(mainTs).not.toContain('FastifyAdapter');

      // Recipe files under apps/api/
      expect(fileExists(outputDir, 'apps/api/src/shared/guards/jwt-auth.guard.ts')).toBe(true);
    });
  });
});

describe('Monorepo relocation: .spoonfeed.json manifest consistency', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each([
    ['monorepo', undefined],
    ['full-stack', 'nextjs'],
  ] as const)('%s project type', (projectType, frontendFramework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-manifest-${projectType}-`),
      );
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('.spoonfeed.json recipe files reference paths relative to recipeOutputDir', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['jwt-auth'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJson(outputDir, '.spoonfeed.json');
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;
      const jwtFiles = recipes['jwt-auth'].files as string[];

      // Verify all listed files actually exist on disk (relative to apps/api/)
      for (const file of jwtFiles) {
        const fullPath = path.join(outputDir, 'apps', 'api', file);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });

    it('.spoonfeed.json records mainTsBlocks for recipes with main.ts setup', async () => {
      const config = makeConfig({
        outputDir,
        projectType,
        frontendFramework: frontendFramework as ProjectConfig['frontendFramework'],
        recipes: ['swagger', 'helmet'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJson(outputDir, '.spoonfeed.json');
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;

      expect(recipes['swagger'].mainTsBlocks).toBeDefined();
      expect(recipes['helmet'].mainTsBlocks).toBeDefined();
    });
  });
});
