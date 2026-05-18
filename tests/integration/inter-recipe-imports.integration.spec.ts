import * as fs from 'node:fs';
import * as path from 'node:path';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { RecipeDefinition, RecipeId } from '@spoonfeed/types';

// Suppress @clack/prompts spinner output in tests (import tree may pull it in)
jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

/**
 * Recursively collect all `.ts` and `.ts.ejs` files under `dir`.
 * Skips node_modules, README.md files, and non-source files.
 */
function walkTemplateFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  function walk(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.ts.ejs')) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Extract all `@/` import paths from a file's content.
 * Handles both `.ts` and `.ejs` files by stripping EJS tags before matching.
 * Skips commented-out imports (lines starting with `//`).
 */
function extractAliasImports(filePath: string): string[] {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Strip EJS tags so they don't interfere with import parsing
  content = content.replace(/<%[\s\S]*?%>/g, '');

  const imports: string[] = [];
  // Match: import ... from '@/some/path'  or  import '@/some/path'
  // Works across both regular .ts and EJS-cleaned content
  const importRegex = /^\s*import\s+(?:type\s+)?(?:.*?\s+from\s+)?['"](@\/[^'"]+)['"]/gm;

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    // Double-check the original line is not commented out
    const lineStart = content.lastIndexOf('\n', match.index) + 1;
    const linePrefix = content.slice(lineStart, match.index).trim();
    if (linePrefix.startsWith('//') || linePrefix.startsWith('*') || linePrefix.startsWith('/*')) {
      continue;
    }
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Convert a file path relative to a `src/` root into an `@/` import path.
 * Strips `.ts.ejs` or `.ts` extensions and normalises separators.
 */
function fileToImportPath(relativePath: string): string {
  let importPath = relativePath;
  if (importPath.endsWith('.ts.ejs')) {
    importPath = importPath.slice(0, -7);
  } else if (importPath.endsWith('.ts')) {
    importPath = importPath.slice(0, -3);
  }
  return `@/${importPath.split(path.sep).join('/')}`;
}

/**
 * Collect all files provided by a template directory (relative `src/` paths).
 * Returns the set of possible `@/` import targets that this directory provides.
 * E.g., a file at `templates/recipes/jwt-auth/src/shared/guards/jwt-auth.guard.ts`
 * produces the target `@/shared/guards/jwt-auth.guard`.
 */
function collectProvidedPaths(templateDir: string): Set<string> {
  const provided = new Set<string>();

  if (!fs.existsSync(templateDir)) return provided;

  const srcDir = path.join(templateDir, 'src');
  if (!fs.existsSync(srcDir)) return provided;

  const files = walkTemplateFiles(srcDir);
  for (const file of files) {
    const relativePath = path.relative(srcDir, file);
    const importPath = fileToImportPath(relativePath);
    provided.add(importPath);

    // Also add the directory index variant -- if the file is `index.ts`,
    // imports may reference the parent directory
    const normalised = importPath.split(path.sep).join('/');
    if (normalised.endsWith('/index')) {
      provided.add(normalised.slice(0, -6));
    }
  }

  return provided;
}

/**
 * Collect `@/` paths provided by ALL project-type templates.
 * Files like `app.module.ts` and `main.ts` are generated for every project type,
 * so they are always available at runtime. We union across all project types to
 * get the full set of always-generated paths.
 */
function collectProjectTypeProvidedPaths(): Set<string> {
  const provided = new Set<string>();
  const projectTypesDir = path.join(TEMPLATES_DIR, 'project-types');

  if (!fs.existsSync(projectTypesDir)) return provided;

  const entries = fs.readdirSync(projectTypesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const ptDir = path.join(projectTypesDir, entry.name);

    // Project types may place src/ at root or under apps/api/
    const srcCandidates = [
      path.join(ptDir, 'src'),
      path.join(ptDir, 'apps', 'api', 'src'),
    ];

    for (const srcDir of srcCandidates) {
      if (!fs.existsSync(srcDir)) continue;

      const files = walkTemplateFiles(srcDir);
      for (const file of files) {
        const relativePath = path.relative(srcDir, file);
        const importPath = fileToImportPath(relativePath);
        provided.add(importPath);
      }
    }
  }

  return provided;
}

/**
 * Resolve the full `requires` chain for a recipe (transitive closure).
 * Returns all recipe IDs that are transitively required.
 */
function resolveRequiresChain(
  recipeId: RecipeId,
  registry: RecipeRegistry,
  visited: Set<RecipeId> = new Set(),
): Set<RecipeId> {
  const recipe = registry.get(recipeId);
  if (!recipe) return visited;

  for (const requiredId of recipe.requires) {
    if (visited.has(requiredId)) continue;
    visited.add(requiredId);
    resolveRequiresChain(requiredId, registry, visited);
  }

  return visited;
}

describe('Inter-recipe imports: no unresolvable @/ imports', () => {
  let registry: RecipeRegistry;
  let recipes: RecipeDefinition[];
  let baseProvidedPaths: Set<string>;
  let generatorProvidedPaths: Set<string>;

  beforeAll(() => {
    registry = createRegistry();
    recipes = registry.getAll();

    // Collect all @/ paths provided by the base template
    baseProvidedPaths = collectProvidedPaths(path.join(TEMPLATES_DIR, 'base'));

    // Collect paths that the generator always produces from project-type templates
    // (e.g., app.module.ts, main.ts). These are available at runtime for all project types.
    generatorProvidedPaths = collectProjectTypeProvidedPaths();
  });

  it('every recipe @/ import resolves to a file in base, own, or required recipe templates', () => {
    const violations: Array<{
      recipeId: string;
      file: string;
      unresolvedImport: string;
    }> = [];

    for (const recipe of recipes) {
      if (!recipe.templateDir) continue;

      const recipeTemplateDir = path.join(TEMPLATES_DIR, 'recipes', recipe.templateDir);
      if (!fs.existsSync(recipeTemplateDir)) continue;

      // Collect files provided by this recipe's own template dir
      const ownProvidedPaths = collectProvidedPaths(recipeTemplateDir);

      // Collect files provided by all transitively required recipes
      const requiredRecipeIds = resolveRequiresChain(recipe.id, registry);
      const requiredProvidedPaths = new Set<string>();
      for (const reqId of requiredRecipeIds) {
        const reqRecipe = registry.get(reqId);
        if (!reqRecipe?.templateDir) continue;
        const reqDir = path.join(TEMPLATES_DIR, 'recipes', reqRecipe.templateDir);
        for (const p of collectProvidedPaths(reqDir)) {
          requiredProvidedPaths.add(p);
        }
      }

      // Scan all template files in this recipe for @/ imports
      const templateFiles = walkTemplateFiles(recipeTemplateDir);
      for (const filePath of templateFiles) {
        const aliasImports = extractAliasImports(filePath);

        for (const importPath of aliasImports) {
          const canResolve =
            baseProvidedPaths.has(importPath) ||
            generatorProvidedPaths.has(importPath) ||
            ownProvidedPaths.has(importPath) ||
            requiredProvidedPaths.has(importPath);

          if (!canResolve) {
            const relativeFile = path.relative(
              path.join(TEMPLATES_DIR, 'recipes'),
              filePath,
            );
            violations.push({
              recipeId: recipe.id,
              file: relativeFile,
              unresolvedImport: importPath,
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  [${v.recipeId}] ${v.file}\n    unresolved: ${v.unresolvedImport}`,
        )
        .join('\n');

      throw new Error(
        `Found ${violations.length} unresolvable @/ import(s) in recipe templates:\n${report}\n\n` +
          'Each @/ import must resolve to a file in the base template, the recipe\'s own ' +
          'template dir, or a transitively required recipe\'s template dir.',
      );
    }
  });

  it('base template @/ imports are self-contained', () => {
    const violations: Array<{
      file: string;
      unresolvedImport: string;
    }> = [];

    const baseDir = path.join(TEMPLATES_DIR, 'base');
    const templateFiles = walkTemplateFiles(baseDir);

    for (const filePath of templateFiles) {
      const aliasImports = extractAliasImports(filePath);

      for (const importPath of aliasImports) {
        if (!baseProvidedPaths.has(importPath) && !generatorProvidedPaths.has(importPath)) {
          const relativeFile = path.relative(baseDir, filePath);
          violations.push({
            file: relativeFile,
            unresolvedImport: importPath,
          });
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}\n    unresolved: ${v.unresolvedImport}`)
        .join('\n');

      throw new Error(
        `Found ${violations.length} unresolvable @/ import(s) in base templates:\n${report}\n\n` +
          'Base template imports must resolve to other files within the base template itself.',
      );
    }
  });
});
