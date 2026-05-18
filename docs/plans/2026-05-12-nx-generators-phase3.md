# Nx Generators Phase 3: remove-recipe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the remove-recipe generator that cleanly removes a recipe from a project — deleting recipe files, removing imports from app.module.ts, removing main.ts blocks, cleaning up env vars and AI context, and updating the manifest.

**Architecture:** The `remove-recipe` generator lives at `src/generators/remove-recipe/` and performs the inverse of `add-recipe`. It reads the `.spoonfeed.json` manifest to discover exactly what the recipe installed (files, module imports, main.ts blocks, env sections, AI context sections), then removes each artifact using the shared utilities from Phases 1-2. A dependency checker prevents removing a recipe that other installed recipes depend on (unless `--force` is used).

**Tech Stack:** @nx/devkit, ts-morph (reusing Phase 2 utilities)

**Spec Reference:** `docs/specs/nx-generators-recipe-management.md` — sections 2.2 (remove-recipe), 4 (manifest), 5.2 (AST removal), 8 Phase 3

**Prerequisites:** Phase 1 (manifest, env-updater, ai-context-updater) and Phase 2 (module-updater, main-ts-updater with AST transforms) must be complete.

---

## Phase Breakdown

This is **Phase 3 of 4**:

1. Foundation: add-recipe + list-recipes (no AST) — complete
2. AST transforms for app.module.ts + main.ts — complete
3. **remove-recipe with manifest tracking** (this plan)
4. migrate-recipe orchestrator

---

## File Map

### Files to Create

| File                                                                         | Responsibility                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/generators/remove-recipe/schema.json`              | Nx schema definition                           |
| `src/generators/remove-recipe/schema.d.ts`              | TypeScript types for schema                    |
| `src/generators/remove-recipe/generator.ts`             | Remove-recipe generator logic                  |
| `src/utils/dependency-checker.ts`                       | Check if other recipes depend on a recipe      |
| `tests/unit/utils/dependency-checker.spec.ts`           | Dependency checker unit tests                  |
| `tests/unit/generators/remove-recipe/generator.spec.ts` | Remove-recipe generator unit tests             |
| `tests/integration/spoonfeed/remove-recipe.integration.spec.ts`            | Add-then-remove round-trip integration test    |
| `tests/e2e/spoonfeed/remove-recipe.e2e.spec.ts`                            | E2E: add swagger, build, remove swagger, build |

### Files to Modify

| File                                                | Change                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `generators.json`              | Register the `remove` generator                                                     |
| `src/utils/recipe-manifest.ts` | Add `removeRecipeFromManifest` if not already exported (verify Phase 1 included it) |

---

## Task 1: remove-recipe schema and types

**Files:**

- Create: `src/generators/remove-recipe/schema.json`
- Create: `src/generators/remove-recipe/schema.d.ts`

- [ ] **Step 1: Create schema.json**

Create `src/generators/remove-recipe/schema.json`:

```json
{
  "$schema": "https://json-schema.org/schema",
  "cli": "nx",
  "$id": "RemoveRecipe",
  "title": "Remove Recipe",
  "type": "object",
  "properties": {
    "recipe": {
      "type": "string",
      "description": "Recipe ID to remove",
      "$default": { "$source": "argv", "index": 0 },
      "x-prompt": "Which recipe do you want to remove?"
    },
    "project": {
      "type": "string",
      "description": "Target project (for monorepo)"
    },
    "force": {
      "type": "boolean",
      "default": false,
      "description": "Remove even if other recipes depend on it"
    },
    "dryRun": {
      "type": "boolean",
      "default": false,
      "description": "Preview changes without applying"
    }
  },
  "required": ["recipe"]
}
```

- [ ] **Step 2: Create schema.d.ts**

Create `src/generators/remove-recipe/schema.d.ts`:

```typescript
export interface RemoveRecipeGeneratorSchema {
  recipe: string;
  project?: string;
  force?: boolean;
  dryRun?: boolean;
}
```

- [ ] **Step 3: Register in generators.json**

Read `generators.json` and add the `remove` entry to the `generators` object:

```json
{
  "generators": {
    "add": {
      "factory": "./dist/generators/add-recipe/generator",
      "schema": "./src/generators/add-recipe/schema.json",
      "description": "Add a recipe to an existing project"
    },
    "list": {
      "factory": "./dist/generators/list-recipes/generator",
      "schema": "./src/generators/list-recipes/schema.json",
      "description": "List installed and available recipes"
    },
    "remove": {
      "factory": "./dist/generators/remove-recipe/generator",
      "schema": "./src/generators/remove-recipe/schema.json",
      "description": "Remove a recipe from an existing project"
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/generators/remove-recipe/schema.json src/generators/remove-recipe/schema.d.ts generators.json
git commit -m "feat(spoonfeed): add remove-recipe generator schema and types"
```

---

## Task 2: Dependency checker

**Files:**

- Create: `src/utils/dependency-checker.ts`
- Create: `tests/unit/utils/dependency-checker.spec.ts`

The dependency checker prevents removing a recipe that other installed recipes depend on via their `requires` field. It scans all installed recipes and returns a list of dependents.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/utils/dependency-checker.spec.ts`:

```typescript
import { findDependents } from '@spoonfeed/utils/dependency-checker';
import type { RecipeDefinition, RecipeId } from '@spoonfeed/types';

function makeRecipe(overrides: Partial<RecipeDefinition> & { id: RecipeId }): RecipeDefinition {
  return {
    name: overrides.id,
    description: '',
    category: 'test',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: overrides.id,
    claudeMdSection: '',
    cursorRules: '',
    copilotInstructions: '',
    ...overrides,
  };
}

describe('dependency-checker', () => {
  it('should return empty array when no recipes depend on the target', () => {
    const recipes: RecipeDefinition[] = [makeRecipe({ id: 'swagger' }), makeRecipe({ id: 'pino' })];

    const result = findDependents('swagger', ['swagger', 'pino'], recipes);
    expect(result).toEqual([]);
  });

  it('should return dependents when another recipe requires the target', () => {
    const recipes: RecipeDefinition[] = [
      makeRecipe({ id: 'jwt-auth' }),
      makeRecipe({ id: 'rbac-casl', requires: ['jwt-auth'] }),
    ];

    const result = findDependents('jwt-auth', ['jwt-auth', 'rbac-casl'], recipes);
    expect(result).toEqual([{ recipeId: 'rbac-casl', recipeName: 'rbac-casl' }]);
  });

  it('should return multiple dependents', () => {
    const recipes: RecipeDefinition[] = [
      makeRecipe({ id: 'jwt-auth' }),
      makeRecipe({ id: 'rbac-casl', requires: ['jwt-auth'] }),
      makeRecipe({ id: 'api-keys', requires: ['jwt-auth'] }),
    ];

    const result = findDependents('jwt-auth', ['jwt-auth', 'rbac-casl', 'api-keys'], recipes);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.recipeId)).toContain('rbac-casl');
    expect(result.map((d) => d.recipeId)).toContain('api-keys');
  });

  it('should only check installed recipes, not all recipes', () => {
    const recipes: RecipeDefinition[] = [
      makeRecipe({ id: 'jwt-auth' }),
      makeRecipe({ id: 'rbac-casl', requires: ['jwt-auth'] }),
    ];

    // rbac-casl is NOT installed, so it should not appear as a dependent
    const result = findDependents('jwt-auth', ['jwt-auth'], recipes);
    expect(result).toEqual([]);
  });

  it('should not list the target recipe itself as a dependent', () => {
    const recipes: RecipeDefinition[] = [makeRecipe({ id: 'jwt-auth', requires: [] })];

    const result = findDependents('jwt-auth', ['jwt-auth'], recipes);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:unit -- --testPathPattern="dependency-checker" --passWithNoTests
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement dependency-checker.ts**

Create `src/utils/dependency-checker.ts`:

```typescript
import type { RecipeDefinition, RecipeId } from '../types.js';

export interface Dependent {
  recipeId: RecipeId;
  recipeName: string;
}

/**
 * Finds all installed recipes that depend on the given target recipe via their `requires` field.
 *
 * @param targetId - The recipe ID being considered for removal
 * @param installedIds - All currently installed recipe IDs
 * @param allRecipes - Full recipe definitions (from registry) for the installed recipes
 * @returns Array of dependents — installed recipes that list `targetId` in their `requires`
 */
export function findDependents(
  targetId: RecipeId,
  installedIds: string[],
  allRecipes: RecipeDefinition[],
): Dependent[] {
  const recipeMap = new Map(allRecipes.map((r) => [r.id, r]));
  const dependents: Dependent[] = [];

  for (const id of installedIds) {
    if (id === targetId) continue;

    const recipe = recipeMap.get(id as RecipeId);
    if (!recipe) continue;

    if (recipe.requires.includes(targetId)) {
      dependents.push({
        recipeId: id as RecipeId,
        recipeName: recipe.name,
      });
    }
  }

  return dependents;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test:unit -- --testPathPattern="dependency-checker"
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dependency-checker.ts tests/unit/utils/dependency-checker.spec.ts
git commit -m "feat(spoonfeed): add dependency checker for recipe removal safety"
```

---

## Task 3: remove-recipe generator implementation

**Files:**

- Create: `src/generators/remove-recipe/generator.ts`

This generator performs the inverse of `add-recipe`. It reads the manifest to discover what was installed and removes each artifact using the shared Phase 1-2 utilities.

**Dependencies on Phase 2 utilities:**

- `removeModuleImport(tree, filePath, moduleName, importPath)` from `src/utils/module-updater.ts`
- `removeMainTsBlock(tree, filePath, blockId)` from `src/utils/main-ts-updater.ts`

**Dependencies on Phase 1 utilities:**

- `removeEnvSection(tree, sectionName)` from `src/utils/env-updater.ts`
- `removeClaudeMdSection(tree, recipeId)`, `removeCursorRules(tree, recipeId)`, `removeCopilotInstructions(tree, recipeId)` from `src/utils/ai-context-updater.ts`
- `readManifest(tree)`, `removeRecipeFromManifest(tree, recipeId)` from `src/utils/recipe-manifest.ts`

> **Note:** The Phase 1 utilities operate on the filesystem directly. In Phase 2, these should have been adapted to work with the Nx `Tree` virtual filesystem for dry-run support. If that adaptation hasn't happened, this task must create Tree-compatible wrappers. The implementation below assumes Tree-compatible versions exist. If they do not, create thin wrappers that read/write via `tree.read()` / `tree.write()` instead of `fs.readFileSync()` / `fs.writeFileSync()`.

- [ ] **Step 1: Implement the generator**

Create `src/generators/remove-recipe/generator.ts`:

```typescript
import { Tree, updateJson, logger } from '@nx/devkit';
import type { RemoveRecipeGeneratorSchema } from './schema.js';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';
import { findDependents } from '../../utils/dependency-checker.js';
import { removeModuleImport } from '../../utils/module-updater.js';
import { removeMainTsBlock } from '../../utils/main-ts-updater.js';
import type { RecipeId, RecipeDefinition } from '../../types.js';

interface RecipeManifestEntry {
  installedAt: string;
  version: string;
  files: string[];
  mainTsBlocks?: string[];
  envSection?: string;
  moduleImport?: {
    moduleName: string;
    importPath: string;
  };
}

interface SpoonfeedManifest {
  projectType: string;
  cloudProvider: string;
  spoonfeedVersion: string;
  generatedAt: string;
  recipes: Record<string, RecipeManifestEntry>;
}

export default async function removeRecipeGenerator(
  tree: Tree,
  options: RemoveRecipeGeneratorSchema,
): Promise<void> {
  const recipeId = options.recipe as RecipeId;

  // 1. Read manifest and confirm recipe is installed
  const manifestPath = '.spoonfeed.json';
  if (!tree.exists(manifestPath)) {
    throw new Error('.spoonfeed.json not found. Is this a spoonfeed-generated project?');
  }

  const manifest = JSON.parse(tree.read(manifestPath, 'utf-8')!) as SpoonfeedManifest;
  const recipeEntry = manifest.recipes[recipeId];

  if (!recipeEntry) {
    throw new Error(
      `Recipe '${recipeId}' is not installed. Run 'nx g spoonfeed:list' to see installed recipes.`,
    );
  }

  // 2. Check that no other installed recipe depends on this one
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);

  const installedIds = Object.keys(manifest.recipes);
  const installedRecipes = installedIds
    .map((id) => registry.get(id as RecipeId))
    .filter(Boolean) as RecipeDefinition[];

  const dependents = findDependents(recipeId, installedIds, installedRecipes);

  if (dependents.length > 0 && !options.force) {
    const dependentNames = dependents.map((d) => `'${d.recipeName}' (${d.recipeId})`).join(', ');
    throw new Error(
      `Cannot remove '${recipeId}': the following installed recipes depend on it: ${dependentNames}. ` +
        `Use --force to remove anyway.`,
    );
  }

  // Look up the recipe definition for dependency metadata
  const recipeDef = registry.get(recipeId);

  // 3. Remove recipe-specific files listed in the manifest
  for (const filePath of recipeEntry.files) {
    if (tree.exists(filePath)) {
      tree.delete(filePath);
      logger.info(`  Deleted: ${filePath}`);
    }
  }

  // Clean up empty directories left behind by deleted files
  cleanEmptyDirectories(tree, recipeEntry.files);

  // 4. Remove dependencies and devDependencies from package.json
  if (recipeDef) {
    const depsToRemove = Object.keys(recipeDef.dependencies);
    const devDepsToRemove = Object.keys(recipeDef.devDependencies);

    if (depsToRemove.length > 0 || devDepsToRemove.length > 0) {
      // Build a set of deps used by OTHER installed recipes so we don't remove shared deps
      const otherRecipeIds = installedIds.filter((id) => id !== recipeId);
      const sharedDeps = new Set<string>();
      for (const otherId of otherRecipeIds) {
        const otherDef = registry.get(otherId as RecipeId);
        if (!otherDef) continue;
        for (const dep of Object.keys(otherDef.dependencies)) sharedDeps.add(dep);
        for (const dep of Object.keys(otherDef.devDependencies)) sharedDeps.add(dep);
      }

      updateJson(tree, 'package.json', (json) => {
        for (const dep of depsToRemove) {
          if (!sharedDeps.has(dep)) {
            delete json.dependencies?.[dep];
          }
        }
        for (const dep of devDepsToRemove) {
          if (!sharedDeps.has(dep)) {
            delete json.devDependencies?.[dep];
          }
        }
        return json;
      });
    }
  }

  // 5. Remove module import from app.module.ts
  if (recipeEntry.moduleImport) {
    const appModulePath = 'src/app.module.ts';
    if (tree.exists(appModulePath)) {
      removeModuleImport(
        tree,
        appModulePath,
        recipeEntry.moduleImport.moduleName,
        recipeEntry.moduleImport.importPath,
      );
      logger.info(`  Removed import: ${recipeEntry.moduleImport.moduleName} from app.module.ts`);
    }
  }

  // 6. Remove main.ts blocks
  if (recipeEntry.mainTsBlocks && recipeEntry.mainTsBlocks.length > 0) {
    const mainTsPath = 'src/main.ts';
    if (tree.exists(mainTsPath)) {
      for (const blockId of recipeEntry.mainTsBlocks) {
        removeMainTsBlock(tree, mainTsPath, blockId);
        logger.info(`  Removed main.ts block: ${blockId}`);
      }

      // Remove any imports that were added for the main.ts blocks.
      // These are tracked via comment markers: // @spoonfeed-import:<recipe-id>
      let mainContent = tree.read(mainTsPath, 'utf-8')!;
      const importMarker = `// @spoonfeed-import:${recipeId}`;
      if (mainContent.includes(importMarker)) {
        const lines = mainContent.split('\n');
        const filtered: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          // Check if the NEXT line is the marker — if so, skip the current line (the import)
          if (i + 1 < lines.length && lines[i + 1].includes(importMarker)) {
            continue;
          }
          // Skip the marker line itself
          if (lines[i].includes(importMarker)) {
            continue;
          }
          filtered.push(lines[i]);
        }

        tree.write(mainTsPath, filtered.join('\n'));
      }
    }
  }

  // 7. Remove env vars section from .env.example
  if (recipeEntry.envSection) {
    const envPath = '.env.example';
    if (tree.exists(envPath)) {
      let content = tree.read(envPath, 'utf-8')!;
      const startMarker = `# --- ${recipeEntry.envSection} ---`;
      const endMarker = `# --- end ${recipeEntry.envSection} ---`;

      const startIdx = content.indexOf(startMarker);
      const endIdx = content.indexOf(endMarker);

      if (startIdx !== -1 && endIdx !== -1) {
        content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
        content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
        tree.write(envPath, content);
        logger.info(`  Removed env section: ${recipeEntry.envSection}`);
      }
    }
  }

  // 8. Remove AI context sections
  removeAiContextSection(tree, 'CLAUDE.md', recipeId);
  removeAiContextSection(tree, '.github/copilot-instructions.md', recipeId);

  // Remove cursor rules file (per-recipe .mdc file)
  const cursorRulePath = `.cursor/rules/${recipeId}.mdc`;
  if (tree.exists(cursorRulePath)) {
    tree.delete(cursorRulePath);
    logger.info(`  Deleted: ${cursorRulePath}`);
  }

  // 9. Update manifest to remove the recipe
  updateJson(tree, manifestPath, (json: SpoonfeedManifest) => {
    delete json.recipes[recipeId];
    return json;
  });

  logger.info(`\nRecipe '${recipeId}' removed successfully.`);
  logger.info('Run `pnpm install` to clean up the lockfile.');
}

/**
 * Removes a delimited AI context section from a markdown file.
 * Sections are wrapped in <!-- @spoonfeed:<id> --> / <!-- @spoonfeed:end:<id> --> markers.
 */
function removeAiContextSection(tree: Tree, filePath: string, recipeId: string): void {
  if (!tree.exists(filePath)) return;

  let content = tree.read(filePath, 'utf-8')!;
  const startMarker = `<!-- @spoonfeed:${recipeId} -->`;
  const endMarker = `<!-- @spoonfeed:end:${recipeId} -->`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
  content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  tree.write(filePath, content);
  logger.info(`  Removed AI context section from: ${filePath}`);
}

/**
 * Removes empty parent directories left behind after file deletion.
 * Walks up from each deleted file's directory and removes if empty.
 */
function cleanEmptyDirectories(tree: Tree, deletedFiles: string[]): void {
  const dirs = new Set<string>();

  for (const file of deletedFiles) {
    let dir = file.substring(0, file.lastIndexOf('/'));
    while (dir && dir !== '.' && dir !== 'src') {
      dirs.add(dir);
      dir = dir.substring(0, dir.lastIndexOf('/'));
    }
  }

  // Sort deepest first so children are cleaned before parents
  const sortedDirs = [...dirs].sort((a, b) => b.split('/').length - a.split('/').length);

  for (const dir of sortedDirs) {
    const children = tree.children(dir);
    if (children.length === 0) {
      // Nx Tree automatically handles empty directories when all children are deleted.
      // This log helps visibility during dry-run.
      logger.info(`  Cleaned empty directory: ${dir}`);
    }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter spoonfeed build
```

Expected: compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/generators/remove-recipe/generator.ts
git commit -m "feat(spoonfeed): implement remove-recipe generator"
```

---

## Task 4: remove-recipe generator unit tests

**Files:**

- Create: `tests/unit/generators/remove-recipe/generator.spec.ts`

These tests use a mock `Tree` from `@nx/devkit/testing` to exercise the generator in isolation.

- [ ] **Step 1: Write the unit test file**

Create `tests/unit/generators/remove-recipe/generator.spec.ts`:

```typescript
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson, updateJson } from '@nx/devkit';
import removeRecipeGenerator from '@spoonfeed/generators/remove-recipe/generator';

/**
 * Creates a minimal project tree with a manifest that has the given recipe installed.
 */
function seedProject(
  tree: Tree,
  recipeId: string,
  recipeEntry: Record<string, unknown> = {},
): void {
  tree.write(
    '.spoonfeed.json',
    JSON.stringify(
      {
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeedVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
        recipes: {
          [recipeId]: {
            installedAt: '2026-05-12T10:05:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
            envSection: null,
            moduleImport: null,
            ...recipeEntry,
          },
        },
      },
      null,
      2,
    ),
  );

  if (!tree.exists('package.json')) {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'test-project', dependencies: {}, devDependencies: {} }, null, 2),
    );
  }
}

describe('remove-recipe generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should throw if manifest does not exist', async () => {
    await expect(removeRecipeGenerator(tree, { recipe: 'swagger' })).rejects.toThrow(
      '.spoonfeed.json not found',
    );
  });

  it('should throw if recipe is not installed', async () => {
    seedProject(tree, 'pino', {});

    await expect(removeRecipeGenerator(tree, { recipe: 'swagger' })).rejects.toThrow(
      "Recipe 'swagger' is not installed",
    );
  });

  it('should remove recipe files listed in the manifest', async () => {
    const files = ['src/infrastructure/swagger/swagger.config.ts'];
    seedProject(tree, 'swagger', { files });
    tree.write(files[0], 'export const swaggerConfig = {};');

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    expect(tree.exists(files[0])).toBe(false);
  });

  it('should remove recipe from manifest after removal', async () => {
    seedProject(tree, 'swagger', {});

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const manifest = readJson(tree, '.spoonfeed.json');
    expect(manifest.recipes['swagger']).toBeUndefined();
  });

  it('should remove module import from app.module.ts', async () => {
    seedProject(tree, 'swagger', {
      moduleImport: {
        moduleName: 'SwaggerModule',
        importPath: '@/infrastructure/swagger/swagger.module',
      },
    });

    tree.write(
      'src/app.module.ts',
      `import { Module } from '@nestjs/common';
import { SwaggerModule } from '@/infrastructure/swagger/swagger.module';

@Module({
  imports: [SwaggerModule],
})
export class AppModule {}
`,
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const content = tree.read('src/app.module.ts', 'utf-8')!;
    expect(content).not.toContain('SwaggerModule');
    expect(content).not.toContain('@/infrastructure/swagger/swagger.module');
    expect(content).toContain('@Module');
  });

  it('should remove main.ts blocks', async () => {
    seedProject(tree, 'swagger', {
      mainTsBlocks: ['swagger-setup'],
    });

    tree.write(
      'src/main.ts',
      `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- swagger-setup start ---
  const swaggerConfig = {};
  // --- swagger-setup end ---

  await app.listen(3000);
}
bootstrap();
`,
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const content = tree.read('src/main.ts', 'utf-8')!;
    expect(content).not.toContain('swagger-setup');
    expect(content).not.toContain('swaggerConfig');
    expect(content).toContain('await app.listen(3000)');
  });

  it('should remove env section from .env.example', async () => {
    seedProject(tree, 'swagger', {
      envSection: 'Swagger / OpenAPI',
    });

    tree.write(
      '.env.example',
      `# Application
PORT=3000
NODE_ENV=development

# --- Swagger / OpenAPI ---
# Enable Swagger UI
SWAGGER_ENABLED=true
# Swagger UI URL path
SWAGGER_PATH=api/docs
# --- end Swagger / OpenAPI ---
`,
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const content = tree.read('.env.example', 'utf-8')!;
    expect(content).not.toContain('SWAGGER_ENABLED');
    expect(content).not.toContain('SWAGGER_PATH');
    expect(content).toContain('PORT=3000');
  });

  it('should remove AI context section from CLAUDE.md', async () => {
    seedProject(tree, 'swagger', {});

    tree.write(
      'CLAUDE.md',
      `# CLAUDE.md

## Package Manager

Always use pnpm.

<!-- @spoonfeed:swagger -->
## Swagger / OpenAPI
Swagger UI is available at /{SWAGGER_PATH}.
<!-- @spoonfeed:end:swagger -->
`,
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const content = tree.read('CLAUDE.md', 'utf-8')!;
    expect(content).not.toContain('Swagger');
    expect(content).toContain('## Package Manager');
  });

  it('should remove dependencies from package.json', async () => {
    seedProject(tree, 'swagger', {});
    updateJson(tree, 'package.json', (json) => {
      json.dependencies['@nestjs/swagger'] = '8.1.0';
      return json;
    });

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const pkg = readJson(tree, 'package.json');
    expect(pkg.dependencies['@nestjs/swagger']).toBeUndefined();
  });

  it('should not remove shared dependencies used by other installed recipes', async () => {
    const manifest = {
      projectType: 'http-api',
      cloudProvider: 'aws',
      spoonfeedVersion: '0.0.1',
      generatedAt: '2026-05-12T10:00:00Z',
      recipes: {
        swagger: {
          installedAt: '2026-05-12T10:05:00Z',
          version: '0.0.1',
          files: [],
          mainTsBlocks: [],
          envSection: null,
          moduleImport: null,
        },
        pino: {
          installedAt: '2026-05-12T10:10:00Z',
          version: '0.0.1',
          files: [],
          mainTsBlocks: [],
          envSection: null,
          moduleImport: null,
        },
      },
    };

    tree.write('.spoonfeed.json', JSON.stringify(manifest, null, 2));
    tree.write(
      'package.json',
      JSON.stringify(
        {
          name: 'test-project',
          dependencies: { 'nestjs-pino': '4.2.0', pino: '9.6.0' },
          devDependencies: { 'pino-pretty': '13.0.0' },
        },
        null,
        2,
      ),
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const pkg = readJson(tree, 'package.json');
    // pino deps should remain since pino recipe is still installed
    expect(pkg.dependencies['nestjs-pino']).toBe('4.2.0');
    expect(pkg.dependencies['pino']).toBe('9.6.0');
  });

  describe('dependency checking', () => {
    it('should throw when another installed recipe depends on the target', async () => {
      const manifest = {
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeedVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
        recipes: {
          'jwt-auth': {
            installedAt: '2026-05-12T10:05:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
          },
          'rbac-casl': {
            installedAt: '2026-05-12T10:10:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
          },
        },
      };

      tree.write('.spoonfeed.json', JSON.stringify(manifest, null, 2));
      tree.write(
        'package.json',
        JSON.stringify({ name: 'test', dependencies: {}, devDependencies: {} }, null, 2),
      );

      await expect(removeRecipeGenerator(tree, { recipe: 'jwt-auth' })).rejects.toThrow(
        "Cannot remove 'jwt-auth'",
      );
    });

    it('should allow removal with --force even when dependents exist', async () => {
      const manifest = {
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeedVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
        recipes: {
          'jwt-auth': {
            installedAt: '2026-05-12T10:05:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
          },
          'rbac-casl': {
            installedAt: '2026-05-12T10:10:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
          },
        },
      };

      tree.write('.spoonfeed.json', JSON.stringify(manifest, null, 2));
      tree.write(
        'package.json',
        JSON.stringify({ name: 'test', dependencies: {}, devDependencies: {} }, null, 2),
      );

      await removeRecipeGenerator(tree, { recipe: 'jwt-auth', force: true });

      const updated = readJson(tree, '.spoonfeed.json');
      expect(updated.recipes['jwt-auth']).toBeUndefined();
      expect(updated.recipes['rbac-casl']).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test:unit -- --testPathPattern="remove-recipe/generator"
```

Expected: 12 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/generators/remove-recipe/generator.spec.ts
git commit -m "test(spoonfeed): add remove-recipe generator unit tests"
```

---

## Task 5: Integration test — add recipe then remove it

**Files:**

- Create: `tests/integration/spoonfeed/remove-recipe.integration.spec.ts`

This test exercises the full round-trip: add a recipe, verify it was applied, then remove it and verify the project returns to its original state (clean diff).

- [ ] **Step 1: Write the integration test**

Create `tests/integration/spoonfeed/remove-recipe.integration.spec.ts`:

```typescript
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson } from '@nx/devkit';
import addRecipeGenerator from '@spoonfeed/generators/add-recipe/generator';
import removeRecipeGenerator from '@spoonfeed/generators/remove-recipe/generator';

/**
 * Creates a minimal project tree that looks like a spoonfeed-generated project.
 * Includes package.json, .spoonfeed.json, app.module.ts, main.ts, .env.example,
 * CLAUDE.md, .github/copilot-instructions.md.
 */
function seedFullProject(tree: Tree): void {
  tree.write(
    '.spoonfeed.json',
    JSON.stringify(
      {
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeedVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
        recipes: {},
      },
      null,
      2,
    ),
  );

  tree.write(
    'package.json',
    JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          '@nestjs/common': '10.4.15',
          '@nestjs/core': '10.4.15',
        },
        devDependencies: {},
      },
      null,
      2,
    ),
  );

  tree.write(
    'src/app.module.ts',
    `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`,
  );

  tree.write(
    'src/main.ts',
    `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
`,
  );

  tree.write(
    '.env.example',
    `# Application
PORT=3000
NODE_ENV=development
`,
  );

  tree.write(
    'CLAUDE.md',
    `# CLAUDE.md

## Package Manager

Always use pnpm.
`,
  );

  tree.write(
    '.github/copilot-instructions.md',
    `# Copilot Instructions

## General

Follow NestJS conventions.
`,
  );
}

/**
 * Captures a snapshot of all file contents in the tree for comparison.
 */
function snapshotTree(tree: Tree, paths: string[]): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const p of paths) {
    if (tree.exists(p)) {
      snapshot.set(p, tree.read(p, 'utf-8')!);
    }
  }
  return snapshot;
}

describe('remove-recipe integration (add then remove round-trip)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedFullProject(tree);
  });

  it('should return project to original state after add + remove of swagger', async () => {
    const trackedFiles = [
      'package.json',
      'src/app.module.ts',
      'src/main.ts',
      '.env.example',
      'CLAUDE.md',
      '.github/copilot-instructions.md',
    ];

    // Capture state before add
    const beforeSnapshot = snapshotTree(tree, trackedFiles);

    // Add swagger
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    // Verify it was added
    const manifestAfterAdd = readJson(tree, '.spoonfeed.json');
    expect(manifestAfterAdd.recipes['swagger']).toBeDefined();

    const pkgAfterAdd = readJson(tree, 'package.json');
    expect(pkgAfterAdd.dependencies['@nestjs/swagger']).toBeDefined();

    // Remove swagger
    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    // Verify manifest is clean
    const manifestAfterRemove = readJson(tree, '.spoonfeed.json');
    expect(manifestAfterRemove.recipes['swagger']).toBeUndefined();
    expect(Object.keys(manifestAfterRemove.recipes)).toHaveLength(0);

    // Verify package.json dependencies are clean
    const pkgAfterRemove = readJson(tree, 'package.json');
    expect(pkgAfterRemove.dependencies['@nestjs/swagger']).toBeUndefined();

    // Verify all tracked files return to original state
    const afterSnapshot = snapshotTree(tree, trackedFiles);
    for (const [filePath, originalContent] of beforeSnapshot) {
      const currentContent = afterSnapshot.get(filePath);
      expect(currentContent).toBe(originalContent);
    }

    // Verify no recipe-specific files remain
    const swaggerFiles = manifestAfterAdd.recipes['swagger']?.files ?? [];
    for (const f of swaggerFiles) {
      expect(tree.exists(f)).toBe(false);
    }
  });

  it('should return project to original state after add + remove of pino', async () => {
    const trackedFiles = ['package.json', 'src/app.module.ts', '.env.example', 'CLAUDE.md'];

    const beforeSnapshot = snapshotTree(tree, trackedFiles);

    await addRecipeGenerator(tree, { recipe: 'pino', skipInstall: true });

    const manifestAfterAdd = readJson(tree, '.spoonfeed.json');
    expect(manifestAfterAdd.recipes['pino']).toBeDefined();

    await removeRecipeGenerator(tree, { recipe: 'pino' });

    const afterSnapshot = snapshotTree(tree, trackedFiles);
    for (const [filePath, originalContent] of beforeSnapshot) {
      expect(afterSnapshot.get(filePath)).toBe(originalContent);
    }
  });

  it('should handle removing one recipe when multiple are installed', async () => {
    // Add two recipes
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });
    await addRecipeGenerator(tree, { recipe: 'helmet', skipInstall: true });

    // Remove only swagger
    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const manifest = readJson(tree, '.spoonfeed.json');
    expect(manifest.recipes['swagger']).toBeUndefined();
    expect(manifest.recipes['helmet']).toBeDefined();

    // Helmet deps should remain
    const pkg = readJson(tree, 'package.json');
    expect(pkg.dependencies['helmet']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
pnpm test -- --testPathPattern="remove-recipe.integration"
```

Expected: all 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/spoonfeed/remove-recipe.integration.spec.ts
git commit -m "test(spoonfeed): add remove-recipe round-trip integration tests"
```

---

## Task 6: E2E test — add swagger, build, remove swagger, build

**Files:**

- Create: `tests/e2e/spoonfeed/remove-recipe.e2e.spec.ts`

This test generates a real project on disk, adds swagger, verifies it compiles, removes swagger, and verifies it still compiles. It exercises the full filesystem path (not the virtual Tree).

- [ ] **Step 1: Write the E2E test**

Create `tests/e2e/spoonfeed/remove-recipe.e2e.spec.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';

const TIMEOUT = 120_000; // 2 minutes

/**
 * Runs a command in the given directory and returns stdout.
 * Uses execFileSync to avoid shell injection.
 * Throws on non-zero exit code.
 */
function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf-8',
    timeout: 60_000,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });
}

describe('remove-recipe E2E', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-e2e-remove-'));
  }, TIMEOUT);

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it(
    'should add swagger, build, remove swagger, build — both succeed',
    () => {
      const spoonfeedBin = path.resolve(__dirname, '../../../dist/index.js');

      // Step 1: Generate a base project using spoonfeed
      run(
        'node',
        [
          spoonfeedBin,
          '--name',
          'e2e-test',
          '--project-type',
          'http-api',
          '--cloud-provider',
          'aws',
          '--no-recipes',
          '--no-ci-cd',
          '--output-dir',
          projectDir,
        ],
        process.cwd(),
      );

      // Verify base project files exist
      expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, '.spoonfeed.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'src/app.module.ts'))).toBe(true);

      // Step 2: Install dependencies
      run('pnpm', ['install', '--frozen-lockfile=false'], projectDir);

      // Step 3: Build to verify clean baseline
      run('pnpm', ['build'], projectDir);

      // Step 4: Add swagger recipe using nx generator
      run(
        'npx',
        ['nx', 'g', 'spoonfeed:add', 'swagger', '--no-interactive'],
        projectDir,
      );

      // Step 5: Install new deps
      run('pnpm', ['install', '--frozen-lockfile=false'], projectDir);

      // Step 6: Build with swagger — should succeed
      run('pnpm', ['build'], projectDir);

      // Verify swagger is in manifest
      const manifestAfterAdd = JSON.parse(
        fs.readFileSync(path.join(projectDir, '.spoonfeed.json'), 'utf-8'),
      );
      expect(manifestAfterAdd.recipes['swagger']).toBeDefined();

      // Verify @nestjs/swagger is in package.json
      const pkgAfterAdd = JSON.parse(
        fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'),
      );
      expect(pkgAfterAdd.dependencies['@nestjs/swagger']).toBeDefined();

      // Step 7: Remove swagger recipe
      run(
        'npx',
        ['nx', 'g', 'spoonfeed:remove', 'swagger', '--no-interactive'],
        projectDir,
      );

      // Step 8: Reinstall to clean lockfile
      run('pnpm', ['install', '--frozen-lockfile=false'], projectDir);

      // Step 9: Build after removal — should succeed
      run('pnpm', ['build'], projectDir);

      // Verify swagger is gone from manifest
      const manifestAfterRemove = JSON.parse(
        fs.readFileSync(path.join(projectDir, '.spoonfeed.json'), 'utf-8'),
      );
      expect(manifestAfterRemove.recipes['swagger']).toBeUndefined();

      // Verify @nestjs/swagger is gone from package.json
      const pkgAfterRemove = JSON.parse(
        fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'),
      );
      expect(pkgAfterRemove.dependencies['@nestjs/swagger']).toBeUndefined();

      // Verify no swagger files remain
      expect(fs.existsSync(path.join(projectDir, 'src/infrastructure/swagger'))).toBe(false);
    },
    TIMEOUT,
  );
});
```

- [ ] **Step 2: Run the E2E test**

```bash
pnpm test:e2e -- --testPathPattern="remove-recipe.e2e"
```

Expected: 1 test passes. This test takes ~60-90 seconds due to `pnpm install` + `pnpm build` cycles.

> **Note:** If the spoonfeed CLI does not support `--no-recipes` or `--no-ci-cd` flags, adjust the generation command to match the actual CLI interface. The key requirement is generating a minimal project without interactive prompts.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/spoonfeed/remove-recipe.e2e.spec.ts
git commit -m "test(spoonfeed): add remove-recipe e2e test (add/build/remove/build)"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run all unit tests**

```bash
pnpm test:unit --passWithNoTests
```

Expected: all tests pass (existing + 5 dependency-checker + 12 generator unit tests).

- [ ] **Step 2: Run integration tests**

```bash
pnpm test -- --testPathPattern="integration"
```

Expected: all integration tests pass including the new round-trip tests.

- [ ] **Step 3: Build spoonfeed**

```bash
pnpm --filter spoonfeed build
```

Expected: compiles with no errors.

- [ ] **Step 4: Build main project**

```bash
pnpm build
```

Expected: 0 TSC issues.

- [ ] **Step 5: Verify generators.json lists all three generators**

```bash
node -e "const g = require('./generators.json'); console.log(Object.keys(g.generators).sort().join(', '))"
```

Expected output: `add, list, remove`

- [ ] **Step 6: Run E2E test (optional, slow)**

```bash
pnpm test:e2e -- --testPathPattern="remove-recipe.e2e"
```

Expected: passes within 2 minutes.
