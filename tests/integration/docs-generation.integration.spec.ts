import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, ProjectType, RecipeId } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

const ALL_PROJECT_TYPES: ProjectType[] = [
  'http-api',
  'aws-lambda',
  'microservice',
  'cli-app',
  'scheduled-worker',
  'monorepo',
  'full-stack',
];

// Recipes that have no conflicts with each other and can safely be combined.
// Deliberately chosen to cover a wide range of categories without triggering
// any declared conflict in the recipe registry.
const NON_CONFLICTING_RECIPES: RecipeId[] = [
  'redis-cache',
  'bullmq',
  'jwt-auth',
  'swagger',
  'pino',
  'health-checks',
  'prometheus',
  'sentry',
  'helmet',
  'cors',
  'throttler',
  'pagination',
  'correlation-id',
  'request-logging',
  'graceful-shutdown',
  'circuit-breaker',
  'feature-flags',
  'changelog',
  'docs-site',
  'sse',
  'request-context',
  'config-validation',
  'webhooks',
  'data-masking',
];

// ─── Helpers ────────────────────────────────────────────────────────────

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

function fileExists(outputDir: string, filePath: string): boolean {
  return fs.existsSync(path.join(outputDir, filePath));
}

function readFile(outputDir: string, filePath: string): string {
  return fs.readFileSync(path.join(outputDir, filePath), 'utf-8');
}

function readJson(outputDir: string, filePath: string): Record<string, unknown> {
  return JSON.parse(readFile(outputDir, filePath)) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. README handling
// ─────────────────────────────────────────────────────────────────────────

describe('README handling', () => {
  const registry = createRegistry();

  describe('base template generates README.md from README.md.ejs', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-readme-'));
      const config = makeConfig({ outputDir: dir });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should have a README.md in the output', () => {
      // The base template has README.md.ejs which IS processed because the skip
      // check on line 53 of generator.ts matches 'README.md' (exact), but the
      // file on disk is 'README.md.ejs'. The .ejs suffix means outputName starts
      // as 'README.md.ejs', which does NOT match 'README.md', so it passes the
      // skip check and gets rendered.
      expect(fileExists(dir, 'README.md')).toBe(true);
    });

    it('should render project name in the README', () => {
      const readme = readFile(dir, 'README.md');
      expect(readme).toContain('test-project');
    });

    it('should render scoped project name when scope is provided', async () => {
      const scopedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-readme-scoped-'));
      try {
        const config = makeConfig({
          outputDir: scopedDir,
          name: 'my-api',
          scope: '@acme',
        });
        await generate(config, registry, TEMPLATES_DIR);
        const readme = readFile(scopedDir, 'README.md');
        expect(readme).toContain('@acme/my-api');
      } finally {
        fs.rmSync(scopedDir, { recursive: true, force: true });
      }
    });

    it('should include getting started instructions', () => {
      const readme = readFile(dir, 'README.md');
      expect(readme).toContain('pnpm install');
      expect(readme).toContain('pnpm start:dev');
    });
  });

  describe('README.md generation across all project types', () => {
    const dirs = new Map<ProjectType, string>();

    beforeAll(async () => {
      for (const projectType of ALL_PROJECT_TYPES) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-readme-${projectType}-`));
        dirs.set(projectType, dir);
        const config = makeConfig({
          outputDir: dir,
          projectType,
          ...(projectType === 'full-stack' && { frontendFramework: 'nextjs' as const }),
          ...(projectType === 'microservice' && { transportLayer: 'tcp' as const }),
        });
        await generate(config, registry, TEMPLATES_DIR);
      }
    });

    afterAll(() => {
      for (const dir of dirs.values()) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it.each(ALL_PROJECT_TYPES)(
      'should generate README.md for %s project type',
      (projectType) => {
        expect(fileExists(dirs.get(projectType)!, 'README.md')).toBe(true);
      },
    );

    it.each(ALL_PROJECT_TYPES)(
      'README.md should contain the project name for %s',
      (projectType) => {
        const readme = readFile(dirs.get(projectType)!, 'README.md');
        expect(readme).toContain('test-project');
      },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. docs-site recipe
// ─────────────────────────────────────────────────────────────────────────

describe('docs-site recipe', () => {
  const registry = createRegistry();

  describe('docs-site with each project type', () => {
    const dirs = new Map<ProjectType, string>();

    beforeAll(async () => {
      for (const projectType of ALL_PROJECT_TYPES) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-docs-${projectType}-`));
        dirs.set(projectType, dir);
        const config = makeConfig({
          outputDir: dir,
          projectType,
          recipes: ['docs-site'],
          ...(projectType === 'full-stack' && { frontendFramework: 'nextjs' as const }),
          ...(projectType === 'microservice' && { transportLayer: 'tcp' as const }),
        });
        await generate(config, registry, TEMPLATES_DIR);
      }
    });

    afterAll(() => {
      for (const dir of dirs.values()) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it.each(ALL_PROJECT_TYPES)(
      'should generate docs/.vitepress/config.ts for %s',
      (projectType) => {
        const dir = dirs.get(projectType)!;
        // For workspace project types (full-stack, monorepo), recipe files go under apps/api/
        const isWorkspace = projectType === 'full-stack' || projectType === 'monorepo';
        const configPath = isWorkspace
          ? 'apps/api/docs/.vitepress/config.ts'
          : 'docs/.vitepress/config.ts';
        expect(fileExists(dir, configPath)).toBe(true);
      },
    );

    it.each(ALL_PROJECT_TYPES)(
      'docs config should reference correct project name for %s',
      (projectType) => {
        const dir = dirs.get(projectType)!;
        const isWorkspace = projectType === 'full-stack' || projectType === 'monorepo';
        const configPath = isWorkspace
          ? 'apps/api/docs/.vitepress/config.ts'
          : 'docs/.vitepress/config.ts';
        const configContent = readFile(dir, configPath);
        expect(configContent).toContain("title: 'test-project'");
        expect(configContent).toContain("description: 'test-project documentation'");
      },
    );

    it.each(ALL_PROJECT_TYPES)(
      'docs config should be valid TypeScript (no unrendered EJS) for %s',
      (projectType) => {
        const dir = dirs.get(projectType)!;
        const isWorkspace = projectType === 'full-stack' || projectType === 'monorepo';
        const configPath = isWorkspace
          ? 'apps/api/docs/.vitepress/config.ts'
          : 'docs/.vitepress/config.ts';
        const configContent = readFile(dir, configPath);
        // No leftover EJS tags
        expect(configContent).not.toContain('<%');
        expect(configContent).not.toContain('%>');
      },
    );

    it.each(ALL_PROJECT_TYPES)(
      'docs-site should generate docs/index.md (VitePress home page) for %s',
      (projectType) => {
        const dir = dirs.get(projectType)!;
        const isWorkspace = projectType === 'full-stack' || projectType === 'monorepo';
        const prefix = isWorkspace ? 'apps/api/' : '';
        // VitePress requires index.md at minimum
        expect(fileExists(dir, `${prefix}docs/index.md`)).toBe(true);
      },
    );

    it('docs-site config references guide pages, and guide/index.md exists', () => {
      const dir = dirs.get('http-api')!;
      const configContent = readFile(dir, 'docs/.vitepress/config.ts');

      // The config references these pages
      expect(configContent).toContain("link: '/guide/'");
      expect(configContent).toContain("link: '/guide/installation'");
      expect(configContent).toContain("link: '/guide/configuration'");
      expect(configContent).toContain("link: '/api/'");

      // guide/index.md now exists as a template
      expect(fileExists(dir, 'docs/guide/index.md')).toBe(true);
      // These pages are still referenced in sidebar but have no template yet
      expect(fileExists(dir, 'docs/guide/installation.md')).toBe(false);
      expect(fileExists(dir, 'docs/guide/configuration.md')).toBe(false);
      expect(fileExists(dir, 'docs/api/index.md')).toBe(false);
    });

    // BUG: The docs-site recipe has a package-fragment.json with docs:dev/docs:build/docs:preview
    // scripts, but the generator only loads package-fragment.json from project-type directories
    it('docs-site recipe package-fragment.json scripts are merged into package.json', () => {
      const dir = dirs.get('http-api')!;
      const pkg = readJson(dir, 'package.json');
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['docs:dev']).toBe('vitepress dev docs');
      expect(scripts['docs:build']).toBe('vitepress build docs');
      expect(scripts['docs:preview']).toBe('vitepress serve docs');
    });

    it('docs-site recipe should add vitepress as a devDependency', () => {
      const dir = dirs.get('http-api')!;
      const pkg = readJson(dir, 'package.json');
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps['vitepress']).toBe('1.5.0');
    });

    // BUG: The docs-site recipe template contains a README.md at its root
    // (templates/recipes/docs-site/README.md). This file is silently skipped by
    // the generator (line 53: if outputName === 'README.md' continue). The file
    // contains recipe documentation (VitePress setup instructions, dependency table)
    // that is presumably meant to be included in the project. However, the skip
    // was intentionally designed to prevent recipe READMEs from overwriting the
    // project's main README.md (generated from base/README.md.ejs). The docs-site
    // README would need to be at a different path (e.g., docs/README.md) to avoid
    // the skip.
    it('BUG: docs-site README.md is silently skipped by generator', () => {
      const dir = dirs.get('http-api')!;
      // The project README.md comes from base/README.md.ejs (rendered with project name)
      const readme = readFile(dir, 'README.md');
      // Verify it's the base README, not the docs-site README
      expect(readme).toContain('test-project');
      expect(readme).not.toContain('VitePress-powered documentation site');
    });

    it('docs config should strip @ prefix from scope in GitHub URLs', async () => {
      const scopedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-docs-scoped-'));
      try {
        const config = makeConfig({
          outputDir: scopedDir,
          name: 'my-api',
          scope: '@acme',
          recipes: ['docs-site'],
        });
        await generate(config, registry, TEMPLATES_DIR);
        const configContent = readFile(scopedDir, 'docs/.vitepress/config.ts');
        // The URL should use 'acme' without the '@' prefix
        expect(configContent).toContain('github.com/acme/my-api');
        expect(configContent).not.toContain('github.com/@acme/my-api');
      } finally {
        fs.rmSync(scopedDir, { recursive: true, force: true });
      }
    });

    it('docs config should handle missing scope gracefully', () => {
      const dir = dirs.get('http-api')!;
      const configContent = readFile(dir, 'docs/.vitepress/config.ts');
      // With no scope (packageScope is undefined), the EJS ternary should render
      // just the project name without a slash prefix
      expect(configContent).not.toContain('undefined');
      expect(configContent).not.toContain('//test-project');
    });
  });

  describe('docs-site with workspace project types', () => {
    let fullStackDir: string;
    let monorepoDir: string;

    beforeAll(async () => {
      fullStackDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-docs-fs-'));
      monorepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-docs-mono-'));

      await generate(
        makeConfig({
          outputDir: fullStackDir,
          projectType: 'full-stack',
          frontendFramework: 'nextjs',
          recipes: ['docs-site'],
        }),
        registry,
        TEMPLATES_DIR,
      );

      await generate(
        makeConfig({
          outputDir: monorepoDir,
          projectType: 'monorepo',
          recipes: ['docs-site'],
        }),
        registry,
        TEMPLATES_DIR,
      );
    });

    afterAll(() => {
      fs.rmSync(fullStackDir, { recursive: true, force: true });
      fs.rmSync(monorepoDir, { recursive: true, force: true });
    });

    it('full-stack: docs config should be under apps/api/', () => {
      expect(fileExists(fullStackDir, 'apps/api/docs/.vitepress/config.ts')).toBe(true);
    });

    it('monorepo: docs config should be under apps/api/', () => {
      expect(fileExists(monorepoDir, 'apps/api/docs/.vitepress/config.ts')).toBe(true);
    });

    it('full-stack: docs config should NOT be at the project root', () => {
      // Docs are recipe files, so they go under apps/api/ for workspace projects.
      // Arguably, docs could live at the root for the whole workspace, but the
      // generator routes all recipe files to apps/api/.
      expect(fileExists(fullStackDir, 'docs/.vitepress/config.ts')).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. AI context file completeness
// ─────────────────────────────────────────────────────────────────────────

describe('AI context file completeness', () => {
  const registry = createRegistry();

  describe('single recipe (docs-site)', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ai-single-'));
      const config = makeConfig({
        outputDir: dir,
        recipes: ['docs-site'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('CLAUDE.md should list docs-site in Active Recipes', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain('## Active Recipes');
      expect(claudeMd).toContain('Documentation Site');
    });

    it('CLAUDE.md should contain docs-site section content', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain('<!-- @spoonfeed:docs-site -->');
      expect(claudeMd).toContain('<!-- @spoonfeed:end:docs-site -->');
      expect(claudeMd).toContain('pnpm docs:dev');
    });

    it('.cursor/rules/project.mdc should exist with docs-site cursor rules', () => {
      expect(fileExists(dir, '.cursor/rules/project.mdc')).toBe(true);
      const cursorRules = readFile(dir, '.cursor/rules/project.mdc');
      expect(cursorRules).toContain('VitePress');
      expect(cursorRules).toContain('docs/');
    });

    it('.github/copilot-instructions.md should exist with docs-site instructions', () => {
      expect(fileExists(dir, '.github/copilot-instructions.md')).toBe(true);
      const copilot = readFile(dir, '.github/copilot-instructions.md');
      expect(copilot).toContain('<!-- @spoonfeed:docs-site -->');
      expect(copilot).toContain('VitePress');
    });
  });

  describe('multiple recipes -- AI context consistency', () => {
    const MULTI_RECIPES: RecipeId[] = [
      'swagger',
      'pino',
      'health-checks',
      'helmet',
      'cors',
      'docs-site',
      'jwt-auth',
      'redis-cache',
    ];
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ai-multi-'));
      const config = makeConfig({
        outputDir: dir,
        recipes: [...MULTI_RECIPES],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('CLAUDE.md should list all selected recipes in Active Recipes', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain('## Active Recipes');
      // Check each recipe's display name appears
      expect(claudeMd).toContain('Swagger / OpenAPI');
      expect(claudeMd).toContain('Pino Logger');
      expect(claudeMd).toContain('Health Checks');
      expect(claudeMd).toContain('Helmet');
      expect(claudeMd).toContain('CORS');
      expect(claudeMd).toContain('Documentation Site');
      expect(claudeMd).toContain('JWT Authentication');
      expect(claudeMd).toContain('Redis Cache');
    });

    it('CLAUDE.md should have section markers for each recipe with claudeMdSection', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      for (const recipeId of MULTI_RECIPES) {
        const recipe = registry.get(recipeId)!;
        if (recipe.claudeMdSection) {
          expect(claudeMd).toContain(`<!-- @spoonfeed:${recipeId} -->`);
          expect(claudeMd).toContain(`<!-- @spoonfeed:end:${recipeId} -->`);
        }
      }
    });

    it('.cursor/rules/project.mdc should contain rules from all recipes that have cursorRules', () => {
      const cursorRules = readFile(dir, '.cursor/rules/project.mdc');
      for (const recipeId of MULTI_RECIPES) {
        const recipe = registry.get(recipeId)!;
        if (recipe.cursorRules) {
          // Verify at least some content from the recipe is present
          expect(cursorRules).toContain(recipe.cursorRules.slice(0, 30));
        }
      }
    });

    it('.github/copilot-instructions.md should contain sections for all recipes with copilotInstructions', () => {
      const copilot = readFile(dir, '.github/copilot-instructions.md');
      for (const recipeId of MULTI_RECIPES) {
        const recipe = registry.get(recipeId)!;
        if (recipe.copilotInstructions) {
          expect(copilot).toContain(`<!-- @spoonfeed:${recipeId} -->`);
          expect(copilot).toContain(`<!-- @spoonfeed:end:${recipeId} -->`);
        }
      }
    });

    it('all three AI context files should reference the same set of recipes', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      const copilot = readFile(dir, '.github/copilot-instructions.md');

      // Extract recipe IDs mentioned in CLAUDE.md section markers
      const claudeMdRecipes = new Set<string>();
      const claudeMdMarkerRegex = /<!-- @spoonfeed:(\S+) -->/g;
      let match: RegExpExecArray | null;
      while ((match = claudeMdMarkerRegex.exec(claudeMd)) !== null) {
        if (!match[1].startsWith('end:')) {
          claudeMdRecipes.add(match[1]);
        }
      }

      // Extract recipe IDs from copilot markers
      const copilotRecipes = new Set<string>();
      const copilotMarkerRegex = /<!-- @spoonfeed:(\S+) -->/g;
      while ((match = copilotMarkerRegex.exec(copilot)) !== null) {
        if (!match[1].startsWith('end:')) {
          copilotRecipes.add(match[1]);
        }
      }

      // CLAUDE.md uses section markers only for recipes with claudeMdSection
      // Copilot uses section markers only for recipes with copilotInstructions
      // These should be the same set since all recipes define both
      // (verify they at least have the same recipe IDs)
      for (const recipeId of MULTI_RECIPES) {
        const recipe = registry.get(recipeId)!;
        if (recipe.claudeMdSection) {
          expect(claudeMdRecipes.has(recipeId)).toBe(true);
        }
        if (recipe.copilotInstructions) {
          expect(copilotRecipes.has(recipeId)).toBe(true);
        }
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. AI context with zero recipes
// ─────────────────────────────────────────────────────────────────────────

describe('AI context with zero recipes', () => {
  const registry = createRegistry();

  describe.each(ALL_PROJECT_TYPES)('%s with no recipes', (projectType) => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-ai-zero-${projectType}-`));
      const config = makeConfig({
        outputDir: dir,
        projectType,
        recipes: [],
        ...(projectType === 'full-stack' && { frontendFramework: 'nextjs' as const }),
        ...(projectType === 'microservice' && { transportLayer: 'tcp' as const }),
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should generate CLAUDE.md', () => {
      expect(fileExists(dir, 'CLAUDE.md')).toBe(true);
    });

    it('CLAUDE.md should have valid structure (no empty sections, no template artifacts)', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain('# CLAUDE.md');
      expect(claudeMd).toContain('## Package Manager');
      expect(claudeMd).toContain('## Imports');
      expect(claudeMd).toContain('## Project');
      // Should NOT have Active Recipes section when there are no recipes
      expect(claudeMd).not.toContain('## Active Recipes');
      // No leftover EJS or template markers
      expect(claudeMd).not.toContain('<%');
      expect(claudeMd).not.toContain('%>');
      expect(claudeMd).not.toContain('undefined');
    });

    it('CLAUDE.md should reference the correct project type', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain(`a ${projectType} project.`);
    });

    // BUG: When zero recipes are selected, assembleCursorRules() returns early
    // (line 73: if (rules.length === 0) return) without creating .cursor/rules/project.mdc.
    // Similarly, assembleCopilotInstructions() returns early (line 86:
    // if (recipesWithInstructions.length === 0) return).
    //
    // This means CLAUDE.md is ALWAYS created (even with 0 recipes, it has project-type
    // metadata), but .cursor/rules/project.mdc and .github/copilot-instructions.md are
    // ONLY created when at least one recipe has cursorRules/copilotInstructions.
    //
    // This inconsistency means:
    // - Claude Code users always get AI context
    // - Cursor and GitHub Copilot users get NO AI context file at all with zero recipes
    // - A project with zero recipes has no .cursor/ or .github/ directories for AI context
    it('BUG: .cursor/rules/project.mdc is NOT created with zero recipes (inconsistent with CLAUDE.md)', () => {
      expect(fileExists(dir, '.cursor/rules/project.mdc')).toBe(false);
      // This is inconsistent: CLAUDE.md is always created with project-type info,
      // but Cursor/Copilot get nothing. At minimum, project-type metadata should
      // be present in all three AI context files.
    });

    it('BUG: .github/copilot-instructions.md is NOT created with zero recipes (inconsistent with CLAUDE.md)', () => {
      expect(fileExists(dir, '.github/copilot-instructions.md')).toBe(false);
      // Same inconsistency as above. Copilot users get no project context.
    });

    it('CLAUDE.md should NOT have broken recipe section markers', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      // With zero recipes, there should be no spoonfeed markers
      expect(claudeMd).not.toContain('<!-- @spoonfeed:');
    });

    it('CLAUDE.md should not have empty lines at the end suggesting a missing section', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      // Trim trailing whitespace and verify it does not end with multiple blank lines
      const trimmed = claudeMd.trimEnd();
      // Should end with actual content, not a dangling section
      expect(trimmed.length).toBeGreaterThan(0);
      // The last line should have content (not be blank)
      const lastLine = trimmed.split('\n').pop()!;
      expect(lastLine.trim().length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. AI context with max recipes (15+)
// ─────────────────────────────────────────────────────────────────────────

describe('AI context with 15+ non-conflicting recipes', () => {
  const registry = createRegistry();
  let dir: string;

  // Use 24 non-conflicting recipes
  const RECIPE_SET = NON_CONFLICTING_RECIPES;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ai-max-'));
    const config = makeConfig({
      outputDir: dir,
      recipes: [...RECIPE_SET],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should generate without error', () => {
    expect(fileExists(dir, 'package.json')).toBe(true);
  });

  it('should use more than 15 recipes', () => {
    // Sanity check that we actually test with 15+ recipes
    expect(RECIPE_SET.length).toBeGreaterThanOrEqual(15);
  });

  it('CLAUDE.md should list all recipes in Active Recipes section', () => {
    const claudeMd = readFile(dir, 'CLAUDE.md');
    expect(claudeMd).toContain('## Active Recipes');
    for (const recipeId of RECIPE_SET) {
      const recipe = registry.get(recipeId)!;
      expect(claudeMd).toContain(`**${recipe.name}**`);
    }
  });

  it('CLAUDE.md should have a section marker for every recipe with claudeMdSection (no truncation)', () => {
    const claudeMd = readFile(dir, 'CLAUDE.md');
    let recipesWithSections = 0;
    let foundSections = 0;
    for (const recipeId of RECIPE_SET) {
      const recipe = registry.get(recipeId)!;
      if (recipe.claudeMdSection) {
        recipesWithSections++;
        if (
          claudeMd.includes(`<!-- @spoonfeed:${recipeId} -->`) &&
          claudeMd.includes(`<!-- @spoonfeed:end:${recipeId} -->`)
        ) {
          foundSections++;
        }
      }
    }
    expect(foundSections).toBe(recipesWithSections);
  });

  it('CLAUDE.md should not have duplicate recipe entries', () => {
    const claudeMd = readFile(dir, 'CLAUDE.md');
    for (const recipeId of RECIPE_SET) {
      const recipe = registry.get(recipeId)!;
      // Each recipe name should appear exactly once in Active Recipes list
      const listPattern = `- **${recipe.name}**`;
      const matches = claudeMd.split(listPattern).length - 1;
      expect(matches).toBe(1);
    }
  });

  it('CLAUDE.md should not have duplicate section markers', () => {
    const claudeMd = readFile(dir, 'CLAUDE.md');
    for (const recipeId of RECIPE_SET) {
      const startMarker = `<!-- @spoonfeed:${recipeId} -->`;
      const startMatches = claudeMd.split(startMarker).length - 1;
      // Should appear at most once (0 if recipe has no claudeMdSection)
      expect(startMatches).toBeLessThanOrEqual(1);
    }
  });

  it('.cursor/rules/project.mdc should exist and have content from all recipes with cursorRules', () => {
    expect(fileExists(dir, '.cursor/rules/project.mdc')).toBe(true);
    const cursorRules = readFile(dir, '.cursor/rules/project.mdc');
    for (const recipeId of RECIPE_SET) {
      const recipe = registry.get(recipeId)!;
      if (recipe.cursorRules) {
        // Verify the full cursorRules content is present, not truncated
        expect(cursorRules).toContain(recipe.cursorRules);
      }
    }
  });

  it('.github/copilot-instructions.md should have markers for all recipes with copilotInstructions', () => {
    expect(fileExists(dir, '.github/copilot-instructions.md')).toBe(true);
    const copilot = readFile(dir, '.github/copilot-instructions.md');
    for (const recipeId of RECIPE_SET) {
      const recipe = registry.get(recipeId)!;
      if (recipe.copilotInstructions) {
        expect(copilot).toContain(`<!-- @spoonfeed:${recipeId} -->`);
        expect(copilot).toContain(`<!-- @spoonfeed:end:${recipeId} -->`);
        // Verify full content is present, not truncated
        expect(copilot).toContain(recipe.copilotInstructions);
      }
    }
  });

  it('.spoonfeed.json manifest should list all recipes', () => {
    const manifest = readJson(dir, '.spoonfeed.json');
    const recipeEntries = manifest.recipes as Record<string, unknown>;
    for (const recipeId of RECIPE_SET) {
      expect(recipeEntries[recipeId]).toBeDefined();
    }
  });

  it('no version conflicts between recipe dependencies', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    // Check for packages that appear in both deps and devDeps with different versions
    const conflicts: string[] = [];
    for (const [name, version] of Object.entries(deps)) {
      if (devDeps[name] && devDeps[name] !== version) {
        conflicts.push(`${name}: deps="${version}" vs devDeps="${devDeps[name]}"`);
      }
    }
    expect(conflicts).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. Additional edge cases
// ─────────────────────────────────────────────────────────────────────────

describe('AI context edge cases', () => {
  const registry = createRegistry();

  describe('workspace project type with recipes should have correct alias in CLAUDE.md', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ai-workspace-'));
      const config = makeConfig({
        outputDir: dir,
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        recipes: ['swagger', 'pino'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('CLAUDE.md should mention apps/api/src/* for workspace projects', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain('apps/api/src/*');
    });

    it('CLAUDE.md should describe workspace layout for full-stack', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain('apps/api/');
      expect(claudeMd).toContain('apps/web/');
      expect(claudeMd).toContain('nextjs');
    });
  });

  describe('monorepo project type CLAUDE.md layout', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ai-mono-'));
      const config = makeConfig({
        outputDir: dir,
        projectType: 'monorepo',
        recipes: ['pino'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('CLAUDE.md should mention monorepo workspace layout', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain('monorepo');
      expect(claudeMd).toContain('apps/api/');
    });

    it('CLAUDE.md should NOT mention apps/web/ for monorepo (no frontend)', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).not.toContain('apps/web/');
    });
  });

  describe('standard project type should use src/* alias', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-ai-std-'));
      const config = makeConfig({
        outputDir: dir,
        projectType: 'http-api',
        recipes: ['pino'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('CLAUDE.md should mention src/* for standard projects', () => {
      const claudeMd = readFile(dir, 'CLAUDE.md');
      expect(claudeMd).toContain('src/*');
      // Should NOT mention apps/api/ for non-workspace projects
      expect(claudeMd).not.toContain('apps/api/');
    });
  });
});
