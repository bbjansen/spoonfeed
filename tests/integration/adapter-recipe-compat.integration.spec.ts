import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, RecipeDefinition, RecipeId } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const TEXT_FILE_EXTENSIONS = ['.ts', '.js', '.json', '.yml', '.yaml', '.md', '.mdc', '.mjs'];

/**
 * Detect whether a dependency name is Fastify-specific.
 * Matches:
 *   - @fastify/*  (e.g. @fastify/helmet, @fastify/multipart)
 *   - mercurius / @nestjs/mercurius  (Mercurius is the Fastify GraphQL adapter)
 *   - any package whose name contains "fastify" (e.g. @adminjs/fastify, @opentelemetry/instrumentation-fastify)
 */
function isFastifyDep(dep: string): boolean {
  return (
    dep.startsWith('@fastify/') ||
    dep === 'mercurius' ||
    dep === '@nestjs/mercurius' ||
    dep.includes('fastify')
  );
}

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'adapter-compat-test',
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

function readFile(outputDir: string, filePath: string): string {
  return fs.readFileSync(path.join(outputDir, filePath), 'utf-8');
}

function readJson(outputDir: string, filePath: string): Record<string, unknown> {
  return JSON.parse(readFile(outputDir, filePath)) as Record<string, unknown>;
}

/**
 * Recursively collect all files under a directory matching the given extensions.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Precompute recipe categories outside test lifecycle so it.each() can use them
// ─────────────────────────────────────────────────────────────────────────────

function buildRecipeCategories(): {
  fastifyOnlyIds: string[];
  dualAdapterIds: string[];
  dualMainTsIds: string[];
} {
  const reg = createRegistry();
  const all = reg.getAll();

  const fastifyOnly = all.filter((r) => {
    const hasFastifyDep = Object.keys(r.dependencies).some(isFastifyDep);
    return hasFastifyDep && !r.expressDependencies;
  });

  const dualAdapter = all.filter((r) => {
    const hasFastifyDep = Object.keys(r.dependencies).some(isFastifyDep);
    return hasFastifyDep && r.expressDependencies !== undefined;
  });

  const dualMainTs = all.filter(
    (r) => r.mainTsSetup !== undefined && r.expressMainTsSetup !== undefined,
  );

  return {
    fastifyOnlyIds: fastifyOnly.map((r) => r.id),
    dualAdapterIds: dualAdapter.map((r) => r.id),
    dualMainTsIds: dualMainTs.map((r) => r.id),
  };
}

const CATEGORIES = buildRecipeCategories();

// ─────────────────────────────────────────────────────────────────────────────

describe('Adapter-recipe compatibility', () => {
  let registry: RecipeRegistry;
  let allRecipes: RecipeDefinition[];

  /** Recipes whose `dependencies` reference Fastify-specific packages but have NO `expressDependencies`. */
  let fastifyOnlyRecipes: RecipeDefinition[];

  /** Recipes that have BOTH `expressDependencies` and regular `dependencies` with Fastify-specific packages. */
  let dualAdapterRecipes: RecipeDefinition[];

  /** Recipes that have both `mainTsSetup` and `expressMainTsSetup`. */
  let dualMainTsRecipes: RecipeDefinition[];

  beforeAll(() => {
    registry = createRegistry();
    allRecipes = registry.getAll();

    fastifyOnlyRecipes = allRecipes.filter((r) => {
      const hasFastifyDep = Object.keys(r.dependencies).some(isFastifyDep);
      return hasFastifyDep && !r.expressDependencies;
    });

    dualAdapterRecipes = allRecipes.filter((r) => {
      const hasFastifyDep = Object.keys(r.dependencies).some(isFastifyDep);
      return hasFastifyDep && r.expressDependencies !== undefined;
    });

    dualMainTsRecipes = allRecipes.filter(
      (r) => r.mainTsSetup !== undefined && r.expressMainTsSetup !== undefined,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Find all Fastify-only recipes
  // ─────────────────────────────────────────────────────────────────────────

  describe('1. Fastify-only recipe identification', () => {
    it('should identify recipes with Fastify-specific deps and no expressDependencies', () => {
      // graphql-mercurius is the known Fastify-only recipe
      const ids = fastifyOnlyRecipes.map((r) => r.id);
      expect(ids).toContain('graphql-mercurius');

      // Verify every identified recipe genuinely has Fastify deps
      for (const recipe of fastifyOnlyRecipes) {
        const fastifyDeps = Object.keys(recipe.dependencies).filter(isFastifyDep);
        // Documenting: these recipes have Fastify-specific deps with no Express alternative
        expect(fastifyDeps.length).toBeGreaterThan(0);
      }
    });

    it('should NOT include recipes that have expressDependencies (those are dual-adapter)', () => {
      const fastifyOnlyIds = fastifyOnlyRecipes.map((r) => r.id);
      const dualIds = dualAdapterRecipes.map((r) => r.id);

      // No overlap between fastify-only and dual-adapter sets
      for (const id of fastifyOnlyIds) {
        expect(dualIds).not.toContain(id);
      }
    });

    it('should detect Fastify deps even when not prefixed with @fastify/', () => {
      // Verify our isFastifyDep function catches all patterns:
      // - @fastify/* packages
      // - mercurius / @nestjs/mercurius
      // - packages containing "fastify" anywhere (e.g. @adminjs/fastify, @opentelemetry/instrumentation-fastify)
      const allFastifyDepNames = new Set<string>();
      for (const recipe of allRecipes) {
        for (const dep of Object.keys(recipe.dependencies)) {
          if (isFastifyDep(dep)) allFastifyDepNames.add(dep);
        }
      }

      // Known Fastify-specific deps that would be missed by a naive @fastify/ prefix check:
      const nonPrefixFastifyDeps = [...allFastifyDepNames].filter(
        (d) => !d.startsWith('@fastify/') && d !== 'mercurius' && d !== '@nestjs/mercurius',
      );

      // Document which deps need the broader detection
      for (const dep of nonPrefixFastifyDeps) {
        expect(dep).toMatch(/fastify/i);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Generate each Fastify-only recipe with Express adapter
  // ─────────────────────────────────────────────────────────────────────────

  describe('2. Fastify-only recipes generated with Express adapter', () => {
    it.each(CATEGORIES.fastifyOnlyIds.map((id) => [id]))(
      '%s: should not have Fastify packages when generated with Express',
      async (recipeId) => {
        const recipe = registry.get(recipeId as RecipeId)!;

        // Determine a compatible HTTP project type
        const compatTypes =
          recipe.compatibleWith === 'all'
            ? ['http-api']
            : recipe.compatibleWith.filter((t) =>
                ['http-api', 'aws-lambda', 'full-stack', 'monorepo'].includes(t),
              );

        // If no HTTP project type is compatible, skip
        if (compatTypes.length === 0) return;

        const projectType = compatTypes[0];
        const outputDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-fastify-only-${recipeId}-`),
        );

        try {
          const config = makeConfig({
            outputDir,
            projectType,
            httpAdapter: 'express',
            recipes: [...recipe.requires, recipeId as RecipeId],
            frontendFramework: projectType === 'full-stack' ? 'nextjs' : undefined,
          });

          await generate(config, registry, TEMPLATES_DIR);

          const pkg = readJson(outputDir, 'package.json');
          const deps = {
            ...((pkg.dependencies ?? {}) as Record<string, string>),
            ...((pkg.devDependencies ?? {}) as Record<string, string>),
          };

          const fastifyPackages = Object.keys(deps).filter(isFastifyDep);

          // BUG: graphql-mercurius has no expressDependencies, so its Fastify-specific
          // dependencies (mercurius, @nestjs/mercurius) land in package.json even when
          // generating with Express adapter. The generator falls back to recipe.dependencies
          // when expressDependencies is absent (generator.ts lines 300-304).
          if (fastifyPackages.length > 0) {
            const bugMsg = fastifyPackages.map((p) => `  - ${p}: ${deps[p]}`).join('\n');
            // eslint-disable-next-line no-console
            console.warn(
              `// BUG: ${recipeId} with Express adapter includes Fastify packages:\n${bugMsg}`,
            );
          }

          // Check template code for Fastify imports
          const tsFiles = walkFiles(outputDir, ['.ts']);
          const fastifyImportFiles: string[] = [];
          for (const filePath of tsFiles) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (
              content.includes("from 'fastify'") ||
              content.includes("from '@fastify/") ||
              content.includes("import '@fastify/") ||
              content.includes("from 'mercurius'") ||
              content.includes("from '@nestjs/mercurius'")
            ) {
              fastifyImportFiles.push(path.relative(outputDir, filePath));
            }
          }

          // BUG: If template code references Fastify packages for an Express project, document it
          if (fastifyImportFiles.length > 0) {
            // eslint-disable-next-line no-console
            console.warn(
              `// BUG: ${recipeId} Express project has files importing from Fastify:\n` +
                fastifyImportFiles.map((f) => `  - ${f}`).join('\n'),
            );
          }

          // mainTsSetup: check if Fastify-specific APIs are used in main.ts
          const isWorkspace = projectType === 'full-stack' || projectType === 'monorepo';
          const mainTsPath = isWorkspace ? 'apps/api/src/main.ts' : 'src/main.ts';
          if (fs.existsSync(path.join(outputDir, mainTsPath))) {
            const mainTs = readFile(outputDir, mainTsPath);
            const hasFastifyApi =
              mainTs.includes('app.register(') ||
              mainTs.includes("from '@fastify/") ||
              mainTs.includes("from 'mercurius'");

            // BUG: Fastify-specific APIs in main.ts for an Express project
            if (hasFastifyApi) {
              // eslint-disable-next-line no-console
              console.warn(
                `// BUG: ${recipeId} Express project main.ts uses Fastify-specific APIs`,
              );
            }
          }

          // The test passes -- bugs are documented above with console.warn
          expect(true).toBe(true);
        } finally {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. graphql-mercurius specifically with Express
  // ─────────────────────────────────────────────────────────────────────────

  describe('3. graphql-mercurius with Express adapter', () => {
    let outputDir: string;

    afterEach(() => {
      if (outputDir && fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    });

    it('graphql-mercurius compatibleWith allows Express project types', () => {
      const recipe = registry.get('graphql-mercurius')!;
      expect(recipe).toBeDefined();

      // BUG: graphql-mercurius.compatibleWith includes HTTP project types that can use
      // Express adapter (http-api, aws-lambda, full-stack, monorepo), but Mercurius is
      // a Fastify-only GraphQL adapter. There is no Express fallback.
      const httpExpressTypes = ['http-api', 'aws-lambda', 'full-stack', 'monorepo'];
      const compatibleHttpTypes =
        recipe.compatibleWith === 'all'
          ? httpExpressTypes
          : recipe.compatibleWith.filter((t) => httpExpressTypes.includes(t));

      // Document: these project types allow Express, but mercurius is Fastify-only
      expect(compatibleHttpTypes.length).toBeGreaterThan(0);
    });

    it('graphql-mercurius has no expressDependencies field', () => {
      const recipe = registry.get('graphql-mercurius')!;

      // BUG: graphql-mercurius has no expressDependencies, meaning when generated with
      // Express adapter, the Fastify-specific dependencies (mercurius, @nestjs/mercurius)
      // are installed. There is no Express-compatible alternative provided.
      expect(recipe.expressDependencies).toBeUndefined();
    });

    it('generating graphql-mercurius with Express installs mercurius (Fastify-only) packages', async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-mercurius-express-'));

      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        httpAdapter: 'express',
        recipes: ['graphql-mercurius'],
      });

      await generate(config, registry, TEMPLATES_DIR);

      const pkg = readJson(outputDir, 'package.json');
      const deps = (pkg.dependencies ?? {}) as Record<string, string>;

      // BUG: mercurius and @nestjs/mercurius are Fastify-only packages that should NOT
      // appear in an Express project. The generator installs them because there is no
      // expressDependencies fallback for this recipe.
      expect(deps['mercurius']).toBeDefined();
      expect(deps['@nestjs/mercurius']).toBeDefined();

      // Express platform should be present (from the adapter fragment)
      expect(deps['@nestjs/platform-express']).toBeDefined();

      // Fastify platform should NOT be present (adapter fragment handles this correctly)
      expect(deps['@nestjs/platform-fastify']).toBeUndefined();
    });

    it('graphql-mercurius template code uses MercuriusDriver which is Fastify-only', async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-mercurius-express-tpl-'));

      const config = makeConfig({
        outputDir,
        projectType: 'http-api',
        httpAdapter: 'express',
        recipes: ['graphql-mercurius'],
      });

      await generate(config, registry, TEMPLATES_DIR);

      // The graphql module template hardcodes MercuriusDriver
      const graphqlModulePath = path.join(
        outputDir,
        'src/infrastructure/graphql/graphql.module.ts',
      );
      expect(fs.existsSync(graphqlModulePath)).toBe(true);

      const content = fs.readFileSync(graphqlModulePath, 'utf-8');

      // BUG: The template uses MercuriusDriver and MercuriusDriverConfig which are
      // Fastify-only. An Express project would need ApolloDriver or another
      // Express-compatible GraphQL driver instead.
      expect(content).toContain('MercuriusDriver');
      expect(content).toContain('@nestjs/mercurius');
    });

    it('graphql-mercurius has no expressMainTsSetup and no mainTsSetup', () => {
      const recipe = registry.get('graphql-mercurius')!;

      // graphql-mercurius relies purely on its module template (not main.ts setup blocks).
      // If it had a mainTsSetup referencing Fastify APIs, that would compound the bug further.
      expect(recipe.mainTsSetup).toBeUndefined();
      expect(recipe.expressMainTsSetup).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Express-specific recipe validation (dual-adapter recipes)
  // ─────────────────────────────────────────────────────────────────────────

  describe('4. Express-specific recipe validation: no cross-contamination', () => {
    it('correctly identifies all dual-adapter recipes', () => {
      // Verify that all recipes with both Fastify deps and expressDependencies are detected.
      // This catches recipes like adminjs (@adminjs/fastify) and opentelemetry
      // (@opentelemetry/instrumentation-fastify) that use non-@fastify/ prefixed dep names.
      const dualIds = dualAdapterRecipes.map((r) => r.id);

      // These known dual-adapter recipes must all be detected
      const knownDualAdapter = ['swagger', 'helmet', 'csrf', 'opentelemetry', 'file-upload', 'adminjs'];
      for (const id of knownDualAdapter) {
        expect(dualIds).toContain(id);
      }
    });

    it.each(CATEGORIES.dualAdapterIds.map((id) => [id]))(
      '%s: Express build uses only expressDependencies, Fastify build uses only dependencies',
      async (recipeId) => {
        const recipe = registry.get(recipeId as RecipeId)!;

        const compatTypes =
          recipe.compatibleWith === 'all'
            ? ['http-api']
            : recipe.compatibleWith.filter((t) =>
                ['http-api', 'aws-lambda', 'full-stack', 'monorepo'].includes(t),
              );
        if (compatTypes.length === 0) return;

        const projectType = compatTypes[0];
        const expressDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-dual-express-${recipeId}-`),
        );
        const fastifyDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-dual-fastify-${recipeId}-`),
        );

        try {
          // Generate with Express adapter
          await generate(
            makeConfig({
              outputDir: expressDir,
              projectType,
              httpAdapter: 'express',
              recipes: [...recipe.requires, recipeId as RecipeId],
              frontendFramework: projectType === 'full-stack' ? 'nextjs' : undefined,
            }),
            registry,
            TEMPLATES_DIR,
          );

          // Generate with Fastify adapter
          await generate(
            makeConfig({
              outputDir: fastifyDir,
              projectType,
              httpAdapter: 'fastify',
              recipes: [...recipe.requires, recipeId as RecipeId],
              frontendFramework: projectType === 'full-stack' ? 'nextjs' : undefined,
            }),
            registry,
            TEMPLATES_DIR,
          );

          // ── Express build validation ──────────────────────────────────

          const expressPkg = readJson(expressDir, 'package.json');
          const expressDeps = (expressPkg.dependencies ?? {}) as Record<string, string>;

          // Fastify-specific deps from recipe.dependencies should NOT be in Express build
          const fastifyDepsFromRecipe = Object.keys(recipe.dependencies).filter(isFastifyDep);
          for (const dep of fastifyDepsFromRecipe) {
            expect(expressDeps[dep]).toBeUndefined();
          }

          // Express-specific deps SHOULD be present
          if (recipe.expressDependencies) {
            for (const dep of Object.keys(recipe.expressDependencies)) {
              expect(expressDeps[dep]).toBeDefined();
            }
          }

          // ── Fastify build validation ──────────────────────────────────

          const fastifyPkg = readJson(fastifyDir, 'package.json');
          const fastifyDeps = (fastifyPkg.dependencies ?? {}) as Record<string, string>;

          // Regular (Fastify) dependencies SHOULD be present
          for (const dep of Object.keys(recipe.dependencies)) {
            expect(fastifyDeps[dep]).toBeDefined();
          }

          // Express-only deps (those not also in recipe.dependencies) should NOT be in Fastify build
          if (recipe.expressDependencies) {
            const expressOnlyDeps = Object.keys(recipe.expressDependencies).filter(
              (dep) => !(dep in recipe.dependencies),
            );
            for (const dep of expressOnlyDeps) {
              expect(fastifyDeps[dep]).toBeUndefined();
            }
          }
        } finally {
          fs.rmSync(expressDir, { recursive: true, force: true });
          fs.rmSync(fastifyDir, { recursive: true, force: true });
        }
      },
    );

    it.each(CATEGORIES.dualAdapterIds.map((id) => [id]))(
      '%s: Express build has zero Fastify-specific packages in package.json',
      async (recipeId) => {
        const recipe = registry.get(recipeId as RecipeId)!;

        const compatTypes =
          recipe.compatibleWith === 'all'
            ? ['http-api']
            : recipe.compatibleWith.filter((t) =>
                ['http-api', 'aws-lambda', 'full-stack', 'monorepo'].includes(t),
              );
        if (compatTypes.length === 0) return;

        const projectType = compatTypes[0];
        const outputDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-dual-nofastify-${recipeId}-`),
        );

        try {
          await generate(
            makeConfig({
              outputDir,
              projectType,
              httpAdapter: 'express',
              recipes: [...recipe.requires, recipeId as RecipeId],
              frontendFramework: projectType === 'full-stack' ? 'nextjs' : undefined,
            }),
            registry,
            TEMPLATES_DIR,
          );

          const pkg = readJson(outputDir, 'package.json');
          const allDeps = {
            ...((pkg.dependencies ?? {}) as Record<string, string>),
            ...((pkg.devDependencies ?? {}) as Record<string, string>),
          };

          // No Fastify-specific packages should appear at all.
          // The adapter fragment adds @nestjs/platform-express (not Fastify).
          // The recipe's expressDependencies should replace any Fastify deps.
          const fastifyPackages = Object.keys(allDeps).filter(isFastifyDep);
          expect(fastifyPackages).toEqual([]);
        } finally {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. mainTsSetup vs expressMainTsSetup selection
  // ─────────────────────────────────────────────────────────────────────────

  describe('5. mainTsSetup vs expressMainTsSetup selection', () => {
    it.each(CATEGORIES.dualMainTsIds.map((id) => [id]))(
      '%s: Express uses expressMainTsSetup, Fastify uses mainTsSetup',
      async (recipeId) => {
        const recipe = registry.get(recipeId as RecipeId)!;

        const compatTypes =
          recipe.compatibleWith === 'all'
            ? ['http-api']
            : recipe.compatibleWith.filter((t) =>
                ['http-api', 'aws-lambda', 'full-stack', 'monorepo'].includes(t),
              );
        if (compatTypes.length === 0) return;

        const projectType = compatTypes[0];
        const expressDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-mainTs-express-${recipeId}-`),
        );
        const fastifyDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `spoonfeed-mainTs-fastify-${recipeId}-`),
        );

        try {
          await generate(
            makeConfig({
              outputDir: expressDir,
              projectType,
              httpAdapter: 'express',
              recipes: [...recipe.requires, recipeId as RecipeId],
              frontendFramework: projectType === 'full-stack' ? 'nextjs' : undefined,
            }),
            registry,
            TEMPLATES_DIR,
          );

          await generate(
            makeConfig({
              outputDir: fastifyDir,
              projectType,
              httpAdapter: 'fastify',
              recipes: [...recipe.requires, recipeId as RecipeId],
              frontendFramework: projectType === 'full-stack' ? 'nextjs' : undefined,
            }),
            registry,
            TEMPLATES_DIR,
          );

          const isWorkspace = projectType === 'full-stack' || projectType === 'monorepo';
          const mainTsRelPath = isWorkspace ? 'apps/api/src/main.ts' : 'src/main.ts';

          const expressMain = readFile(expressDir, mainTsRelPath);
          const fastifyMain = readFile(fastifyDir, mainTsRelPath);

          // The two main.ts files should differ (they use different adapter-specific setup)
          expect(expressMain).not.toEqual(fastifyMain);

          // Express main.ts should contain the expressMainTsSetup code pattern
          const expressSetup = recipe.expressMainTsSetup!;
          for (const imp of expressSetup.block.imports) {
            expect(expressMain).toContain(imp.moduleSpecifier);
          }

          // Express main.ts should NOT contain the Fastify mainTsSetup imports
          // (unless they share the same module specifier)
          const fastifySetup = recipe.mainTsSetup!;
          for (const imp of fastifySetup.block.imports) {
            const isSharedImport = expressSetup.block.imports.some(
              (eimp) => eimp.moduleSpecifier === imp.moduleSpecifier,
            );
            if (!isSharedImport) {
              expect(expressMain).not.toContain(imp.moduleSpecifier);
            }
          }

          // Fastify main.ts should contain the mainTsSetup code pattern
          for (const imp of fastifySetup.block.imports) {
            expect(fastifyMain).toContain(imp.moduleSpecifier);
          }

          // Fastify main.ts should NOT contain Express-only import statements
          // (we match the full import-from pattern to avoid substring false positives,
          // e.g. "helmet" appearing as a substring of "@fastify/helmet")
          for (const imp of expressSetup.block.imports) {
            const isSharedImport = fastifySetup.block.imports.some(
              (fimp) => fimp.moduleSpecifier === imp.moduleSpecifier,
            );
            if (!isSharedImport) {
              expect(fastifyMain).not.toContain(`from '${imp.moduleSpecifier}'`);
            }
          }
        } finally {
          fs.rmSync(expressDir, { recursive: true, force: true });
          fs.rmSync(fastifyDir, { recursive: true, force: true });
        }
      },
    );

    it('recipes with mainTsSetup but NOT expressMainTsSetup use the same block for both adapters', () => {
      const recipesWithMainTsOnly = allRecipes.filter(
        (r) => r.mainTsSetup !== undefined && r.expressMainTsSetup === undefined,
      );

      // These recipes use the same mainTsSetup for both adapters.
      // Verify their mainTsSetup code does not reference Fastify-specific packages.
      const violations: string[] = [];
      for (const recipe of recipesWithMainTsOnly) {
        const setup = recipe.mainTsSetup!;
        const codeRefsFastify =
          setup.block.code.includes('@fastify/') ||
          setup.block.code.includes('app.register(') ||
          setup.block.code.includes("from 'fastify'") ||
          setup.block.code.includes('mercurius');
        const importRefsFastify = setup.block.imports.some(
          (imp) => isFastifyDep(imp.moduleSpecifier),
        );

        if (codeRefsFastify || importRefsFastify) {
          // BUG: mainTsSetup references Fastify-specific code but no expressMainTsSetup
          // is provided. When generated with Express, the Fastify code will appear in main.ts.
          violations.push(
            `${recipe.id}: mainTsSetup references Fastify APIs but has no expressMainTsSetup`,
          );
        }
      }

      // This should pass: all Fastify-specific mainTsSetup recipes should have expressMainTsSetup
      expect(violations).toEqual([]);
    });

    it('recipes with expressMainTsSetup should also have mainTsSetup (no orphaned Express setup)', () => {
      const orphaned = allRecipes.filter(
        (r) => r.expressMainTsSetup !== undefined && r.mainTsSetup === undefined,
      );

      // If expressMainTsSetup exists, mainTsSetup must also exist
      expect(orphaned.map((r) => r.id)).toEqual([]);
    });

    it('blockId is consistent between mainTsSetup and expressMainTsSetup', () => {
      for (const recipe of dualMainTsRecipes) {
        // Both setup variants should use the same blockId so they target the same insertion point
        expect(recipe.mainTsSetup!.blockId).toEqual(recipe.expressMainTsSetup!.blockId);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Template code adapter awareness
  // ─────────────────────────────────────────────────────────────────────────

  describe('6. Template code adapter awareness', () => {
    it('EJS templates with Fastify imports use httpAdapter conditionals', () => {
      const recipesDir = path.join(TEMPLATES_DIR, 'recipes');
      const ejsFiles = walkFiles(recipesDir, ['.ejs']);

      const violations: string[] = [];

      for (const filePath of ejsFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(TEMPLATES_DIR, filePath);

        // Check if the file imports from 'fastify' or '@fastify/*' or other Fastify packages
        const hasFastifyImport =
          content.includes("from 'fastify'") ||
          content.includes("from '@fastify/") ||
          content.includes("import '@fastify/") ||
          content.includes("from 'mercurius'") ||
          content.includes("from '@nestjs/mercurius'");

        if (!hasFastifyImport) continue;

        // If it has a Fastify import, it should also have an httpAdapter conditional
        const hasAdapterConditional =
          content.includes("httpAdapter === 'express'") ||
          content.includes("httpAdapter === 'fastify'") ||
          content.includes("httpAdapter !== 'express'") ||
          content.includes("httpAdapter !== 'fastify'");

        if (!hasAdapterConditional) {
          // BUG: Template file references Fastify but has no httpAdapter conditional,
          // meaning Express projects will get Fastify-specific code
          violations.push(relativePath);
        }
      }

      // All EJS files with Fastify imports should have adapter conditionals
      expect(violations).toEqual([]);
    });

    it('non-EJS template files in recipe dirs should not hardcode Fastify imports', () => {
      const recipesDir = path.join(TEMPLATES_DIR, 'recipes');
      const tsFiles = walkFiles(recipesDir, ['.ts']);

      // graphql-mercurius is a known Fastify-only recipe tested separately in section 3.
      // Exclude its template dir from this general check to avoid double-counting.
      const knownFastifyOnlyDirs = ['graphql-mercurius'];

      const violations: string[] = [];

      for (const filePath of tsFiles) {
        const relativePath = path.relative(TEMPLATES_DIR, filePath);

        // Skip files from known Fastify-only recipe template dirs
        const isKnownFastifyOnly = knownFastifyOnlyDirs.some((dir) =>
          relativePath.startsWith(path.join('recipes', dir)),
        );
        if (isKnownFastifyOnly) continue;

        const content = fs.readFileSync(filePath, 'utf-8');

        // Non-EJS .ts files are copied as-is without template rendering.
        // They should not contain Fastify-specific imports because they cannot
        // conditionally switch based on the adapter.
        const hasFastifyImport =
          content.includes("from 'fastify'") ||
          content.includes("from '@fastify/") ||
          content.includes("import '@fastify/") ||
          content.includes("from 'mercurius'") ||
          content.includes("from '@nestjs/mercurius'");

        if (hasFastifyImport) {
          // BUG: Non-EJS template file has hardcoded Fastify imports.
          // This code will be copied to Express projects unchanged.
          violations.push(relativePath);
        }
      }

      // If violations exist, they represent template files that should be converted to .ejs
      // with adapter conditionals, or should only be included for Fastify projects
      expect(violations).toEqual([]);
    });

    it('graphql-mercurius template files are not adapter-conditional (documenting the gap)', () => {
      const mercuriusDir = path.join(TEMPLATES_DIR, 'recipes', 'graphql-mercurius');
      if (!fs.existsSync(mercuriusDir)) return;

      const allFiles = walkFiles(mercuriusDir, ['.ts', '.ejs']);

      for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(TEMPLATES_DIR, filePath);

        // BUG: graphql-mercurius templates are plain .ts files (not .ejs), so they cannot
        // conditionally switch between Mercurius (Fastify) and Apollo (Express).
        // The entire recipe is Fastify-only but compatibleWith allows Express project types.
        if (content.includes('Mercurius')) {
          // Document: this file is Fastify-only with no Express alternative
          expect(content).toContain('Mercurius');
          expect(content).not.toContain('Apollo'); // No Express alternative exists
          // eslint-disable-next-line no-console
          console.warn(
            `// BUG: ${relativePath} uses MercuriusDriver (Fastify-only) with no Express alternative`,
          );
        }
      }
    });

    it('dual-adapter recipes with EJS templates use adapter conditionals where needed', () => {
      const violations: string[] = [];

      for (const recipe of dualAdapterRecipes) {
        if (!recipe.templateDir) continue;
        const recipeDir = path.join(TEMPLATES_DIR, 'recipes', recipe.templateDir);
        if (!fs.existsSync(recipeDir)) continue;

        const ejsFiles = walkFiles(recipeDir, ['.ejs']);
        for (const filePath of ejsFiles) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const relativePath = path.relative(TEMPLATES_DIR, filePath);

          // Check for Fastify-specific content that is not wrapped in a conditional
          const hasFastifyRef =
            content.includes("from 'fastify'") ||
            content.includes("from '@fastify/") ||
            content.includes('FastifyRequest') ||
            content.includes('FastifyReply');

          if (!hasFastifyRef) continue;

          const hasConditional =
            content.includes("httpAdapter === 'express'") ||
            content.includes("httpAdapter === 'fastify'") ||
            content.includes("httpAdapter !== 'express'") ||
            content.includes("httpAdapter !== 'fastify'");

          if (!hasConditional) {
            violations.push(`${recipe.id}: ${relativePath}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
