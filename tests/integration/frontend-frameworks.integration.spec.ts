import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, FrontendFramework, RecipeId } from '@spoonfeed/types';
import { FRONTEND_FRAMEWORKS } from '@spoonfeed/types';

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

// ── Framework-specific config files ──────────────────────────────────

const FRAMEWORK_CONFIG_FILES: Record<FrontendFramework, string[]> = {
  nextjs: ['next.config.ts'],
  'vite-react': ['vite.config.ts'],
  nuxt: ['nuxt.config.ts'],
  sveltekit: ['svelte.config.js', 'vite.config.ts'],
};

// Files unique to each frontend framework (must be present in apps/web/)
const FRAMEWORK_UNIQUE_FILES: Record<FrontendFramework, string[]> = {
  nextjs: ['src/app/page.tsx', 'src/app/layout.tsx'],
  'vite-react': ['index.html', 'src/App.tsx', 'src/main.tsx'],
  nuxt: ['app.vue', 'pages/index.vue'],
  sveltekit: ['src/app.html', 'src/routes/+page.svelte'],
};

// Key dependencies in each framework's package.json
const FRAMEWORK_DEPS: Record<FrontendFramework, string[]> = {
  nextjs: ['next', 'react', 'react-dom'],
  'vite-react': ['react', 'react-dom'],
  nuxt: ['nuxt', 'vue'],
  sveltekit: [],  // sveltekit puts svelte in devDeps
};

const FRAMEWORK_DEV_DEPS: Record<FrontendFramework, string[]> = {
  nextjs: ['typescript'],
  'vite-react': ['vite', '@vitejs/plugin-react', 'typescript'],
  nuxt: ['typescript'],
  sveltekit: ['svelte', '@sveltejs/kit', 'vite', 'typescript'],
};

// NestJS-specific files that must never appear in apps/web/
const NESTJS_MARKER_FILES = [
  'main.ts',
  'app.module.ts',
  'shared/filters/http-exception.filter.ts',
  'shared/interceptors/response.interceptor.ts',
];

// Frontend extensions that must never appear in apps/api/
const FRONTEND_EXTENSIONS = ['.tsx', '.jsx', '.vue', '.svelte'];

// ── 1. Generate full-stack with each frontend framework ──────────────

describe('Frontend frameworks: generation with each framework and adapter', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(FRONTEND_FRAMEWORKS.map((fw) => [fw]))('%s frontend', (framework) => {
    describe.each(['express', 'fastify'] as const)('%s adapter', (httpAdapter) => {
      let outputDir: string;

      beforeEach(() => {
        outputDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-fe-${framework}-${httpAdapter}-`),
        );
      });

      afterEach(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('creates apps/web/ directory with framework-specific files', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        // apps/web/ must exist
        expect(fileExists(outputDir, 'apps/web')).toBe(true);

        // Framework-specific source files
        for (const file of FRAMEWORK_UNIQUE_FILES[framework as FrontendFramework]) {
          expect(fileExists(outputDir, `apps/web/${file}`)).toBe(true);
        }
      });

      it('creates apps/api/ directory with NestJS files', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        // NestJS core files must be under apps/api/
        expect(fileExists(outputDir, 'apps/api/src/main.ts')).toBe(true);
        expect(fileExists(outputDir, 'apps/api/src/app.module.ts')).toBe(true);
        expect(fileExists(outputDir, 'apps/api/tests/e2e/app.e2e-spec.ts')).toBe(true);
      });

      it('has no NestJS files in apps/web/', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        for (const nestFile of NESTJS_MARKER_FILES) {
          expect(fileExists(outputDir, `apps/web/${nestFile}`)).toBe(false);
          expect(fileExists(outputDir, `apps/web/src/${nestFile}`)).toBe(false);
        }
      });

      it('has no frontend-specific files in apps/api/', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        const apiFiles = collectFiles(path.join(outputDir, 'apps', 'api'), outputDir);
        const frontendFilesInApi = apiFiles.filter((f) =>
          FRONTEND_EXTENSIONS.includes(path.extname(f)),
        );
        expect(frontendFilesInApi).toEqual([]);
      });

      it('apps/web/package.json has correct framework dependencies', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        const webPkg = readJson(outputDir, 'apps/web/package.json');
        const deps = (webPkg.dependencies ?? {}) as Record<string, string>;
        const devDeps = (webPkg.devDependencies ?? {}) as Record<string, string>;

        for (const dep of FRAMEWORK_DEPS[framework as FrontendFramework]) {
          expect(deps[dep]).toBeDefined();
        }
        for (const dep of FRAMEWORK_DEV_DEPS[framework as FrontendFramework]) {
          expect(devDeps[dep]).toBeDefined();
        }
      });

      it('framework-specific config files exist in apps/web/', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        for (const configFile of FRAMEWORK_CONFIG_FILES[framework as FrontendFramework]) {
          expect(fileExists(outputDir, `apps/web/${configFile}`)).toBe(true);
        }
      });

      it('apps/api/src/main.ts uses correct HTTP adapter', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        const mainTs = readFile(outputDir, 'apps/api/src/main.ts');
        if (httpAdapter === 'express') {
          expect(mainTs).toContain('NestFactory.create(AppModule)');
          expect(mainTs).not.toContain('FastifyAdapter');
        } else {
          expect(mainTs).toContain('FastifyAdapter');
        }
      });

      it('root src/ directory does not exist after relocation', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        expect(fileExists(outputDir, 'src')).toBe(false);
      });

      it('root tests/ directory does not exist after relocation', async () => {
        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          httpAdapter,
          frontendFramework: framework as FrontendFramework,
        });
        await generate(config, registry, TEMPLATES_DIR);

        expect(fileExists(outputDir, 'tests')).toBe(false);
      });
    });
  });
});

// ── 2. Frontend + recipe interaction ─────────────────────────────────

describe('Frontend frameworks: recipe files go to apps/api/, not apps/web/', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  const RECIPES_WITH_FILES: RecipeId[] = ['jwt-auth', 'health-checks', 'pino', 'correlation-id'];

  describe.each(FRONTEND_FRAMEWORKS.map((fw) => [fw]))('%s frontend', (framework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-fe-recipe-${framework}-`),
      );
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('jwt-auth guard ends up under apps/api/, not apps/web/', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
        recipes: ['jwt-auth'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'apps/api/src/shared/guards/jwt-auth.guard.ts')).toBe(true);
      expect(fileExists(outputDir, 'apps/web/src/shared/guards/jwt-auth.guard.ts')).toBe(false);
      expect(fileExists(outputDir, 'apps/web/shared/guards/jwt-auth.guard.ts')).toBe(false);
    });

    it('health-checks files end up under apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
        recipes: ['health-checks'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'apps/api/src/shared/health/health.controller.ts')).toBe(true);
      expect(fileExists(outputDir, 'apps/api/src/shared/health/health.module.ts')).toBe(true);
    });

    it('swagger main.ts block is inserted into apps/api/src/main.ts', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
        recipes: ['swagger'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'apps/api/src/main.ts');
      expect(mainTs).toContain('SwaggerModule');
    });

    it('multiple recipes: all src files land under apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
        recipes: [...RECIPES_WITH_FILES],
      });
      await generate(config, registry, TEMPLATES_DIR);

      // No orphaned root src/ or tests/
      expect(fileExists(outputDir, 'src')).toBe(false);
      expect(fileExists(outputDir, 'tests')).toBe(false);

      // All files at root level should not be source files
      const allFiles = collectFiles(outputDir, outputDir);
      const orphanedFiles = allFiles.filter(
        (f) => f.startsWith('src/') || f.startsWith('tests/'),
      );
      expect(orphanedFiles).toEqual([]);
    });

    it('recipe env vars in .env.example at root, not in apps/web/', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
        recipes: ['typeorm-postgres'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, '.env.example')).toBe(true);
      const envContent = readFile(outputDir, '.env.example');
      expect(envContent).toContain('DB_HOST');

      // .env.example should NOT be duplicated into apps/web/
      expect(fileExists(outputDir, 'apps/web/.env.example')).toBe(false);
    });
  });
});

// ── 3. Frontend framework template completeness ──────────────────────

describe('Frontend frameworks: template directory completeness', () => {
  const frontendBaseDir = path.join(TEMPLATES_DIR, 'project-types', 'full-stack', 'frontend');

  it('frontend template base directory exists', () => {
    expect(fs.existsSync(frontendBaseDir)).toBe(true);
  });

  describe.each(FRONTEND_FRAMEWORKS.map((fw) => [fw]))('%s template', (framework) => {
    const frameworkDir = path.join(frontendBaseDir, framework);

    it('template directory exists', () => {
      expect(fs.existsSync(frameworkDir)).toBe(true);
    });

    it('template directory is not empty', () => {
      const files = collectFiles(frameworkDir, frameworkDir);
      expect(files.length).toBeGreaterThan(0);
    });

    it('has a package.json', () => {
      expect(fs.existsSync(path.join(frameworkDir, 'package.json'))).toBe(true);
    });

    it('package.json is valid JSON with name field', () => {
      const rawPkg = fs.readFileSync(path.join(frameworkDir, 'package.json'), 'utf-8');
      const pkg = JSON.parse(rawPkg) as Record<string, unknown>;
      expect(pkg.name).toBeDefined();
    });

    it('has framework-specific config files', () => {
      for (const configFile of FRAMEWORK_CONFIG_FILES[framework as FrontendFramework]) {
        expect(fs.existsSync(path.join(frameworkDir, configFile))).toBe(true);
      }
    });

    it('has a CLAUDE.md', () => {
      expect(fs.existsSync(path.join(frameworkDir, 'CLAUDE.md'))).toBe(true);
    });

    it('CLAUDE.md mentions the framework name or key technology', () => {
      const claudeMd = fs.readFileSync(path.join(frameworkDir, 'CLAUDE.md'), 'utf-8');
      const frameworkKeywords: Record<FrontendFramework, string[]> = {
        nextjs: ['Next.js', 'next'],
        'vite-react': ['React', 'Vite'],
        nuxt: ['Nuxt', 'Vue'],
        sveltekit: ['SvelteKit', 'Svelte'],
      };
      const keywords = frameworkKeywords[framework as FrontendFramework];
      const found = keywords.some((kw) => claudeMd.includes(kw));
      expect(found).toBe(true);
    });

    it('has framework-specific source files', () => {
      for (const file of FRAMEWORK_UNIQUE_FILES[framework as FrontendFramework]) {
        expect(fs.existsSync(path.join(frameworkDir, file))).toBe(true);
      }
    });

    it('has a tsconfig.json (except sveltekit which may use svelte.config.js)', () => {
      if (framework !== 'sveltekit') {
        expect(fs.existsSync(path.join(frameworkDir, 'tsconfig.json'))).toBe(true);
      }
    });
  });
});

// ── 4. Full-stack without frontendFramework ──────────────────────────

describe('Frontend frameworks: full-stack with undefined frontendFramework', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-fe-undef-'));
    registry = createRegistry();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('does not crash when frontendFramework is undefined', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'full-stack',
      frontendFramework: undefined,
    });

    // Should not throw
    await expect(generate(config, registry, TEMPLATES_DIR)).resolves.not.toThrow();
  });

  it('still creates apps/api/ with NestJS files', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'full-stack',
      frontendFramework: undefined,
    });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'apps/api/src/main.ts')).toBe(true);
    expect(fileExists(outputDir, 'apps/api/src/app.module.ts')).toBe(true);
  });

  // BUG: When frontendFramework is undefined for full-stack, apps/web/ is not created.
  // The generator only copies the frontend template when config.frontendFramework is truthy
  // (line 110: `if (config.projectType === 'full-stack' && config.frontendFramework)`).
  // This means a full-stack project without a frontend framework gets no apps/web/ directory,
  // making the pnpm-workspace.yaml reference to apps/* partially broken (only apps/api/ exists).
  // This is arguably a bug or at minimum an undocumented edge case: the full-stack project type
  // installs workspace tooling (nx, pnpm-workspace.yaml) but produces no frontend app.
  it('apps/web/ is NOT created when frontendFramework is undefined', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'full-stack',
      frontendFramework: undefined,
    });
    await generate(config, registry, TEMPLATES_DIR);

    // BUG: full-stack without frontendFramework silently omits apps/web/ entirely.
    // The workspace config (pnpm-workspace.yaml, nx.json) still references apps/*
    // but there is no web app, making this config inconsistent.
    expect(fileExists(outputDir, 'apps/web')).toBe(false);
  });

  it('workspace config files are still created even without a frontend', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'full-stack',
      frontendFramework: undefined,
    });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'pnpm-workspace.yaml')).toBe(true);
    expect(fileExists(outputDir, 'nx.json')).toBe(true);
  });

  it('root src/ is still relocated under apps/api/', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'full-stack',
      frontendFramework: undefined,
    });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'src')).toBe(false);
    expect(fileExists(outputDir, 'apps/api/src/main.ts')).toBe(true);
  });

  it('recipes still go to apps/api/ even without frontend', async () => {
    const config = makeConfig({
      outputDir,
      projectType: 'full-stack',
      frontendFramework: undefined,
      recipes: ['jwt-auth'],
    });
    await generate(config, registry, TEMPLATES_DIR);

    expect(fileExists(outputDir, 'apps/api/src/shared/guards/jwt-auth.guard.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(false);
  });
});

// ── 5. AI context for full-stack ─────────────────────────────────────

describe('Frontend frameworks: AI context files for full-stack', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(FRONTEND_FRAMEWORKS.map((fw) => [fw]))('%s frontend', (framework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-fe-ai-${framework}-`),
      );
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('root CLAUDE.md mentions full-stack project type', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const claudeMd = readFile(outputDir, 'CLAUDE.md');
      expect(claudeMd).toContain('full-stack');
    });

    it('root CLAUDE.md mentions the frontend framework and apps/web layout', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const claudeMd = readFile(outputDir, 'CLAUDE.md');

      expect(claudeMd).toContain('apps/web');
      expect(claudeMd).toContain('apps/api');
    });

    it('apps/web/CLAUDE.md exists with frontend-specific guidance', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Each frontend template ships its own CLAUDE.md
      expect(fileExists(outputDir, 'apps/web/CLAUDE.md')).toBe(true);

      const webClaudeMd = readFile(outputDir, 'apps/web/CLAUDE.md');
      expect(webClaudeMd.length).toBeGreaterThan(0);
    });

    it('root CLAUDE.md import alias description is accurate for full-stack', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const claudeMd = readFile(outputDir, 'CLAUDE.md');

      // CLAUDE.md should say @/* maps to apps/api/src/* for full-stack projects
      expect(claudeMd).toContain('apps/api/src/*');

      // Verify the tsconfig matches the CLAUDE.md description
      const tsConfig = readJson(outputDir, 'tsconfig.json');
      const compilerOptions = tsConfig.compilerOptions as Record<string, unknown>;
      const paths = compilerOptions.paths as Record<string, string[]>;
      expect(paths['@/*']).toEqual(['apps/api/src/*']);
    });
  });

  describe('cursor rules for full-stack', () => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-fe-cursor-'));
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('cursor rules with recipes are created at root', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        recipes: ['typeorm-postgres'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, '.cursor/rules/project.mdc')).toBe(true);
      const cursorRules = readFile(outputDir, '.cursor/rules/project.mdc');
      expect(cursorRules).toContain('TypeORM');
    });
  });
});

// ── 6. Cross-framework consistency ───────────────────────────────────

describe('Frontend frameworks: cross-framework consistency', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  const frameworkOutputs: Map<string, string> = new Map();

  afterAll(() => {
    for (const dir of frameworkOutputs.values()) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('all 4 frontend frameworks produce structurally consistent full-stack projects', async () => {
    for (const framework of FRONTEND_FRAMEWORKS) {
      const outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-fe-consistency-${framework}-`),
      );
      frameworkOutputs.set(framework, outputDir);

      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework,
        recipes: ['swagger', 'jwt-auth'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    }

    // All frameworks should produce the same root-level structure
    for (const framework of FRONTEND_FRAMEWORKS) {
      const dir = frameworkOutputs.get(framework)!;

      // Common root files
      expect(fileExists(dir, 'package.json')).toBe(true);
      expect(fileExists(dir, 'pnpm-workspace.yaml')).toBe(true);
      expect(fileExists(dir, 'nx.json')).toBe(true);
      expect(fileExists(dir, 'tsconfig.json')).toBe(true);
      expect(fileExists(dir, '.spoonfeed.json')).toBe(true);
      expect(fileExists(dir, 'CLAUDE.md')).toBe(true);

      // apps/api/ structure is identical regardless of frontend
      expect(fileExists(dir, 'apps/api/src/main.ts')).toBe(true);
      expect(fileExists(dir, 'apps/api/src/app.module.ts')).toBe(true);
      expect(fileExists(dir, 'apps/api/src/shared/guards/jwt-auth.guard.ts')).toBe(true);

      // apps/web/ has a package.json
      expect(fileExists(dir, 'apps/web/package.json')).toBe(true);
      expect(fileExists(dir, 'apps/web/CLAUDE.md')).toBe(true);

      // No orphan root src/ or tests/
      expect(fileExists(dir, 'src')).toBe(false);
      expect(fileExists(dir, 'tests')).toBe(false);
    }
  });

  it('root package.json is the same structure across all frontend frameworks', async () => {
    // Generate if not already done
    if (frameworkOutputs.size === 0) {
      for (const framework of FRONTEND_FRAMEWORKS) {
        const outputDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-fe-rootpkg-${framework}-`),
        );
        frameworkOutputs.set(framework, outputDir);

        const config = makeConfig({
          outputDir,
          projectType: 'full-stack',
          frontendFramework: framework,
        });
        await generate(config, registry, TEMPLATES_DIR);
      }
    }

    const rootPkgs: Record<string, unknown>[] = [];
    for (const framework of FRONTEND_FRAMEWORKS) {
      const dir = frameworkOutputs.get(framework)!;
      rootPkgs.push(readJson(dir, 'package.json'));
    }

    // All root package.json files should have the same devDependencies keys
    const firstDevDeps = Object.keys(
      (rootPkgs[0].devDependencies ?? {}) as Record<string, string>,
    ).sort();
    for (let i = 1; i < rootPkgs.length; i++) {
      const devDeps = Object.keys(
        (rootPkgs[i].devDependencies ?? {}) as Record<string, string>,
      ).sort();
      expect(devDeps).toEqual(firstDevDeps);
    }
  });
});

// ── 7. .spoonfeed.json manifest for full-stack with frontend ─────────

describe('Frontend frameworks: manifest correctness', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(FRONTEND_FRAMEWORKS.map((fw) => [fw]))('%s frontend', (framework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-fe-manifest-${framework}-`),
      );
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('.spoonfeed.json records full-stack project type', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJson(outputDir, '.spoonfeed.json');
      expect(manifest.projectType).toBe('full-stack');
    });

    it('.spoonfeed.json records the frontend framework', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJson(outputDir, '.spoonfeed.json');

      expect(manifest.frontendFramework).toBe(framework);
    });

    it('recipe files in manifest reference paths relative to apps/api/', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
        recipes: ['jwt-auth'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const manifest = readJson(outputDir, '.spoonfeed.json');
      const recipes = manifest.recipes as Record<string, Record<string, unknown>>;
      const jwtFiles = recipes['jwt-auth'].files as string[];

      // Files in the manifest should exist relative to apps/api/
      for (const file of jwtFiles) {
        const fullPath = path.join(outputDir, 'apps', 'api', file);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });
  });
});

// ── 8. Full-stack with CORS_ORIGIN env var ───────────────────────────

describe('Frontend frameworks: CORS configuration', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(FRONTEND_FRAMEWORKS.map((fw) => [fw]))('%s frontend', (framework) => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-fe-cors-${framework}-`),
      );
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('full-stack main.ts enables CORS', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTs = readFile(outputDir, 'apps/api/src/main.ts');
      expect(mainTs).toContain('enableCors');
    });

    it('frontend config file has API proxy configuration', async () => {
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: framework as FrontendFramework,
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Each framework configures a proxy to the API backend
      const configFileMap: Record<FrontendFramework, string> = {
        nextjs: 'apps/web/next.config.ts',
        'vite-react': 'apps/web/vite.config.ts',
        nuxt: 'apps/web/nuxt.config.ts',
        sveltekit: 'apps/web/vite.config.ts',
      };

      const configPath = configFileMap[framework as FrontendFramework];
      const configContent = readFile(outputDir, configPath);

      // All frameworks should proxy /api to localhost:3000
      expect(configContent).toContain('localhost:3000');
    });
  });
});
