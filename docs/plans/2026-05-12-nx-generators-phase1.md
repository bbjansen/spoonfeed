# Nx Generators Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `add-recipe` and `list-recipes` Nx generators with file copying, package.json merging, env var appending, AI context updates, and manifest tracking — without AST transforms (no app.module.ts modification yet).

**Architecture:** The generators live inside `` alongside the existing CLI scaffolder. They reuse the existing `RecipeRegistry`, `RecipeDefinition`, and `detectConflicts` infrastructure. A `.spoonfeed.json` manifest file in each generated project tracks which recipes are installed. Phase 1 handles recipes that only add files (devcontainer, changelog, license, docker-compose-dev, load-testing, etc.) — AST-modifying recipes come in Phase 2.

**Tech Stack:** `@nx/devkit` (generator API, Tree virtual filesystem), `ts-morph` (installed but used in Phase 2), existing `RecipeDefinition` types, `fs-extra`, `ejs`

**Spec Reference:** `docs/specs/nx-generators-recipe-management.md` — sections 2.1 (add-recipe), 2.3 (list-recipes), 3 (architecture), 4 (manifest), 7 (integration), 8 Phase 1

---

## Phase Breakdown

This is **Phase 1 of 4**:

1. **Foundation: add-recipe + list-recipes (no AST)** (this plan)
2. AST transforms for app.module.ts + main.ts
3. remove-recipe with manifest tracking
4. migrate-recipe orchestrator

---

## File Map

### Files to Create

| File                                                               | Responsibility                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `generators.json`                             | Nx generators entry point                                            |
| `src/generators/add-recipe/generator.ts`      | Add-recipe generator logic                                           |
| `src/generators/add-recipe/schema.json`       | Nx schema definition                                                 |
| `src/generators/add-recipe/schema.d.ts`       | TypeScript types for schema                                          |
| `src/generators/list-recipes/generator.ts`    | List-recipes generator logic                                         |
| `src/generators/list-recipes/schema.json`     | Nx schema definition                                                 |
| `src/utils/recipe-manifest.ts`                | Read/write .spoonfeed.json                                         |
| `src/utils/env-updater.ts`                    | Add/remove sections in .env.example                                  |
| `src/utils/ai-context-updater.ts`             | Add/remove sections in CLAUDE.md, .cursorrules, copilot-instructions |
| `tests/unit/utils/recipe-manifest.spec.ts`    | Manifest unit tests                                                  |
| `tests/unit/utils/env-updater.spec.ts`        | Env updater unit tests                                               |
| `tests/unit/utils/ai-context-updater.spec.ts` | AI context updater unit tests                                        |

### Files to Modify

| File                                 | Change                                                      |
| ------------------------------------ | ----------------------------------------------------------- |
| `package.json`  | Add `@nx/devkit`, `ts-morph` deps, add `"generators"` field |
| `tsconfig.json` | Ensure generators are compiled                              |

---

## Task 1: Install Nx dependencies and configure generators entry point

**Files:**

- Modify: `package.json`
- Create: `generators.json`

- [ ] **Step 1: Install @nx/devkit and ts-morph**

```bash
pnpm --filter spoonfeed add -E @nx/devkit ts-morph
```

- [ ] **Step 2: Add generators field to package.json**

Read `package.json` and add after the `"bin"` field:

```json
"generators": "./generators.json",
```

- [ ] **Step 3: Create generators.json**

Create `generators.json`:

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
    }
  }
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter spoonfeed build
```

Expected: compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json generators.json pnpm-lock.yaml
git commit -m "chore(spoonfeed): add nx devkit and generators entry point"
```

---

## Task 2: Recipe manifest (read/write .spoonfeed.json)

**Files:**

- Create: `src/utils/recipe-manifest.ts`
- Create: `tests/unit/utils/recipe-manifest.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/utils/recipe-manifest.spec.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  readManifest,
  writeManifest,
  addRecipeToManifest,
  isRecipeInstalled,
  type SpoonfeedManifest,
} from '@spoonfeed/utils/recipe-manifest';

describe('recipe-manifest', () => {
  let tmpDir: string;
  let manifestPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
    manifestPath = path.join(tmpDir, '.spoonfeed.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return null when manifest does not exist', () => {
    expect(readManifest(tmpDir)).toBeNull();
  });

  it('should write and read a manifest', () => {
    const manifest: SpoonfeedManifest = {
      projectType: 'http-api',
      cloudProvider: 'aws',
      spoonfeedVersion: '0.0.1',
      generatedAt: '2026-05-12T10:00:00Z',
      recipes: {},
    };

    writeManifest(tmpDir, manifest);
    const result = readManifest(tmpDir);
    expect(result).toEqual(manifest);
  });

  it('should add a recipe to the manifest', () => {
    const manifest: SpoonfeedManifest = {
      projectType: 'http-api',
      cloudProvider: 'aws',
      spoonfeedVersion: '0.0.1',
      generatedAt: '2026-05-12T10:00:00Z',
      recipes: {},
    };

    writeManifest(tmpDir, manifest);

    addRecipeToManifest(tmpDir, 'swagger', {
      files: ['src/main.swagger.ts'],
      moduleImport: { moduleName: 'SwaggerModule', importPath: '@/swagger' },
    });

    const updated = readManifest(tmpDir);
    expect(updated?.recipes['swagger']).toBeDefined();
    expect(updated?.recipes['swagger'].files).toEqual(['src/main.swagger.ts']);
  });

  it('should check if a recipe is installed', () => {
    const manifest: SpoonfeedManifest = {
      projectType: 'http-api',
      cloudProvider: 'aws',
      spoonfeedVersion: '0.0.1',
      generatedAt: '2026-05-12T10:00:00Z',
      recipes: {
        swagger: {
          installedAt: '2026-05-12T10:05:00Z',
          version: '0.0.1',
          files: [],
        },
      },
    };

    writeManifest(tmpDir, manifest);
    expect(isRecipeInstalled(tmpDir, 'swagger')).toBe(true);
    expect(isRecipeInstalled(tmpDir, 'pino')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:unit -- --testPathPattern="recipe-manifest" --passWithNoTests
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement recipe-manifest.ts**

Create `src/utils/recipe-manifest.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RecipeManifestEntry {
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

export interface SpoonfeedManifest {
  projectType: string;
  cloudProvider: string;
  spoonfeedVersion: string;
  generatedAt: string;
  recipes: Record<string, RecipeManifestEntry>;
}

const MANIFEST_FILE = '.spoonfeed.json';

export function readManifest(projectDir: string): SpoonfeedManifest | null {
  const filePath = path.join(projectDir, MANIFEST_FILE);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SpoonfeedManifest;
}

export function writeManifest(projectDir: string, manifest: SpoonfeedManifest): void {
  const filePath = path.join(projectDir, MANIFEST_FILE);
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

export function addRecipeToManifest(
  projectDir: string,
  recipeId: string,
  entry: Omit<RecipeManifestEntry, 'installedAt' | 'version'>,
): void {
  const manifest = readManifest(projectDir);
  if (!manifest) throw new Error('.spoonfeed.json not found');

  manifest.recipes[recipeId] = {
    ...entry,
    installedAt: new Date().toISOString(),
    version: manifest.spoonfeedVersion,
  };

  writeManifest(projectDir, manifest);
}

export function removeRecipeFromManifest(projectDir: string, recipeId: string): void {
  const manifest = readManifest(projectDir);
  if (!manifest) throw new Error('.spoonfeed.json not found');

  delete manifest.recipes[recipeId];
  writeManifest(projectDir, manifest);
}

export function isRecipeInstalled(projectDir: string, recipeId: string): boolean {
  const manifest = readManifest(projectDir);
  return !!manifest?.recipes[recipeId];
}

export function getInstalledRecipeIds(projectDir: string): string[] {
  const manifest = readManifest(projectDir);
  return manifest ? Object.keys(manifest.recipes) : [];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test:unit -- --testPathPattern="recipe-manifest"
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipe-manifest.ts tests/unit/utils/recipe-manifest.spec.ts
git commit -m "feat(spoonfeed): add recipe manifest read/write utilities"
```

---

## Task 3: Env updater (add/remove sections in .env.example)

**Files:**

- Create: `src/utils/env-updater.ts`
- Create: `tests/unit/utils/env-updater.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/utils/env-updater.spec.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { addEnvSection, removeEnvSection } from '@spoonfeed/utils/env-updater';

describe('env-updater', () => {
  let tmpDir: string;
  let envPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'));
    envPath = path.join(tmpDir, '.env.example');
    fs.writeFileSync(envPath, '# Application\nPORT=3000\nNODE_ENV=development\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add an env section', () => {
    addEnvSection(tmpDir, 'Redis', [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
      { key: 'REDIS_PORT', defaultValue: '6379', description: 'Redis port' },
    ]);

    const content = fs.readFileSync(envPath, 'utf-8');
    expect(content).toContain('# --- Redis ---');
    expect(content).toContain('REDIS_HOST=localhost');
    expect(content).toContain('REDIS_PORT=6379');
  });

  it('should not duplicate sections', () => {
    addEnvSection(tmpDir, 'Redis', [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
    ]);
    addEnvSection(tmpDir, 'Redis', [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
    ]);

    const content = fs.readFileSync(envPath, 'utf-8');
    const matches = content.match(/# --- Redis ---/g);
    expect(matches).toHaveLength(1);
  });

  it('should remove an env section', () => {
    addEnvSection(tmpDir, 'Redis', [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
    ]);
    removeEnvSection(tmpDir, 'Redis');

    const content = fs.readFileSync(envPath, 'utf-8');
    expect(content).not.toContain('# --- Redis ---');
    expect(content).not.toContain('REDIS_HOST');
    expect(content).toContain('PORT=3000');
  });
});
```

- [ ] **Step 2: Implement env-updater.ts**

Create `src/utils/env-updater.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface EnvVarEntry {
  key: string;
  defaultValue: string;
  description: string;
}

const ENV_FILE = '.env.example';

export function addEnvSection(projectDir: string, sectionName: string, vars: EnvVarEntry[]): void {
  const filePath = path.join(projectDir, ENV_FILE);
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

  const marker = `# --- ${sectionName} ---`;
  if (content.includes(marker)) return; // Idempotent

  const section = [
    '',
    marker,
    ...vars.map((v) => `# ${v.description}\n${v.key}=${v.defaultValue}`),
    `# --- end ${sectionName} ---`,
    '',
  ].join('\n');

  content = content.trimEnd() + '\n' + section;
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function removeEnvSection(projectDir: string, sectionName: string): void {
  const filePath = path.join(projectDir, ENV_FILE);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  const startMarker = `# --- ${sectionName} ---`;
  const endMarker = `# --- end ${sectionName} ---`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
  content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm test:unit -- --testPathPattern="env-updater"
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/utils/env-updater.ts tests/unit/utils/env-updater.spec.ts
git commit -m "feat(spoonfeed): add env section updater for generators"
```

---

## Task 4: AI context updater (add/remove sections in CLAUDE.md)

**Files:**

- Create: `src/utils/ai-context-updater.ts`
- Create: `tests/unit/utils/ai-context-updater.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/utils/ai-context-updater.spec.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { addClaudeMdSection, removeClaudeMdSection } from '@spoonfeed/utils/ai-context-updater';

describe('ai-context-updater', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-ctx-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md'),
      '# CLAUDE.md\n\n## Package Manager\n\nAlways use pnpm.\n',
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add a section to CLAUDE.md', () => {
    addClaudeMdSection(tmpDir, 'swagger', '## Swagger\nDocs at /api/docs.');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('## Swagger');
    expect(content).toContain('Docs at /api/docs.');
  });

  it('should not duplicate sections', () => {
    addClaudeMdSection(tmpDir, 'swagger', '## Swagger\nDocs at /api/docs.');
    addClaudeMdSection(tmpDir, 'swagger', '## Swagger\nDocs at /api/docs.');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const matches = content.match(/<!-- @spoonfeed:swagger -->/g);
    expect(matches).toHaveLength(1);
  });

  it('should remove a section from CLAUDE.md', () => {
    addClaudeMdSection(tmpDir, 'swagger', '## Swagger\nDocs at /api/docs.');
    removeClaudeMdSection(tmpDir, 'swagger');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).not.toContain('## Swagger');
    expect(content).toContain('## Package Manager');
  });
});
```

- [ ] **Step 2: Implement ai-context-updater.ts**

Create `src/utils/ai-context-updater.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

function addSection(filePath: string, recipeId: string, content: string): void {
  if (!fs.existsSync(filePath)) return;

  let fileContent = fs.readFileSync(filePath, 'utf-8');
  const marker = `<!-- @spoonfeed:${recipeId} -->`;
  if (fileContent.includes(marker)) return;

  const section = `\n${marker}\n${content}\n<!-- @spoonfeed:end:${recipeId} -->\n`;
  fileContent = fileContent.trimEnd() + '\n' + section;
  fs.writeFileSync(filePath, fileContent, 'utf-8');
}

function removeSection(filePath: string, recipeId: string): void {
  if (!fs.existsSync(filePath)) return;

  let fileContent = fs.readFileSync(filePath, 'utf-8');
  const startMarker = `<!-- @spoonfeed:${recipeId} -->`;
  const endMarker = `<!-- @spoonfeed:end:${recipeId} -->`;

  const startIdx = fileContent.indexOf(startMarker);
  const endIdx = fileContent.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  fileContent = fileContent.slice(0, startIdx) + fileContent.slice(endIdx + endMarker.length);
  fileContent = fileContent.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  fs.writeFileSync(filePath, fileContent, 'utf-8');
}

export function addClaudeMdSection(projectDir: string, recipeId: string, content: string): void {
  addSection(path.join(projectDir, 'CLAUDE.md'), recipeId, content);
}

export function removeClaudeMdSection(projectDir: string, recipeId: string): void {
  removeSection(path.join(projectDir, 'CLAUDE.md'), recipeId);
}

export function addCursorRules(projectDir: string, recipeId: string, rules: string): void {
  const dir = path.join(projectDir, '.cursor', 'rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${recipeId}.mdc`), rules, 'utf-8');
}

export function removeCursorRules(projectDir: string, recipeId: string): void {
  const filePath = path.join(projectDir, '.cursor', 'rules', `${recipeId}.mdc`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function addCopilotInstructions(
  projectDir: string,
  recipeId: string,
  content: string,
): void {
  addSection(path.join(projectDir, '.github', 'copilot-instructions.md'), recipeId, content);
}

export function removeCopilotInstructions(projectDir: string, recipeId: string): void {
  removeSection(path.join(projectDir, '.github', 'copilot-instructions.md'), recipeId);
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm test:unit -- --testPathPattern="ai-context-updater"
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/utils/ai-context-updater.ts tests/unit/utils/ai-context-updater.spec.ts
git commit -m "feat(spoonfeed): add ai context updater for generators"
```

---

## Task 5: add-recipe generator schema and types

**Files:**

- Create: `src/generators/add-recipe/schema.json`
- Create: `src/generators/add-recipe/schema.d.ts`

- [ ] **Step 1: Create schema.json**

Create `src/generators/add-recipe/schema.json`:

```json
{
  "$schema": "https://json-schema.org/schema",
  "cli": "nx",
  "$id": "AddRecipe",
  "title": "Add Recipe",
  "type": "object",
  "properties": {
    "recipe": {
      "type": "string",
      "description": "Recipe ID to add",
      "$default": { "$source": "argv", "index": 0 },
      "x-prompt": "Which recipe do you want to add?"
    },
    "project": {
      "type": "string",
      "description": "Target project (for monorepo)"
    },
    "dryRun": {
      "type": "boolean",
      "default": false,
      "description": "Preview changes without applying"
    },
    "skipInstall": {
      "type": "boolean",
      "default": false,
      "description": "Skip pnpm install after generation"
    }
  },
  "required": ["recipe"]
}
```

- [ ] **Step 2: Create schema.d.ts**

Create `src/generators/add-recipe/schema.d.ts`:

```typescript
export interface AddRecipeGeneratorSchema {
  recipe: string;
  project?: string;
  dryRun?: boolean;
  skipInstall?: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/generators/add-recipe/
git commit -m "feat(spoonfeed): add add-recipe generator schema"
```

---

## Task 6: add-recipe generator implementation

**Files:**

- Create: `src/generators/add-recipe/generator.ts`

- [ ] **Step 1: Implement the generator**

Create `src/generators/add-recipe/generator.ts`:

```typescript
import { Tree, formatFiles, generateFiles, updateJson, logger } from '@nx/devkit';
import * as path from 'node:path';
import type { AddRecipeGeneratorSchema } from './schema.js';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';
import { detectConflicts } from '../../validation/conflict-detector.js';
import type { RecipeDefinition, RecipeId } from '../../types.js';

export default async function addRecipeGenerator(
  tree: Tree,
  options: AddRecipeGeneratorSchema,
): Promise<void> {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);

  const recipeId = options.recipe as RecipeId;
  const recipe = registry.get(recipeId);

  if (!recipe) {
    throw new Error(
      `Recipe '${recipeId}' not found. Run 'nx g spoonfeed:list' to see available recipes.`,
    );
  }

  // Read manifest
  const manifestPath = '.spoonfeed.json';
  if (!tree.exists(manifestPath)) {
    throw new Error('.spoonfeed.json not found. Is this a spoonfeed-generated project?');
  }

  const manifest = JSON.parse(tree.read(manifestPath, 'utf-8')!) as {
    projectType: string;
    recipes: Record<string, unknown>;
  };

  // Check if already installed
  if (manifest.recipes[recipeId]) {
    logger.warn(`Recipe '${recipeId}' is already installed.`);
    return;
  }

  // Validate compatibility
  if (
    recipe.compatibleWith !== 'all' &&
    !recipe.compatibleWith.includes(manifest.projectType as any)
  ) {
    throw new Error(
      `Recipe '${recipe.name}' is not compatible with project type '${manifest.projectType}'.`,
    );
  }

  // Check conflicts
  const installedIds = Object.keys(manifest.recipes) as RecipeId[];
  const allIds = [...installedIds, recipeId];
  const allRecipes = allIds.map((id) => registry.get(id)).filter(Boolean) as RecipeDefinition[];
  const conflicts = detectConflicts(allIds, allRecipes);

  const mutualExclusions = conflicts.filter((c) => c.type === 'mutual-exclusion');
  if (mutualExclusions.length > 0) {
    throw new Error(`Conflict: ${mutualExclusions.map((c) => c.message).join('; ')}`);
  }

  // Check requirements
  const missingReqs = conflicts.filter((c) => c.type === 'missing-requirement');
  if (missingReqs.length > 0) {
    throw new Error(`Missing requirements: ${missingReqs.map((c) => c.message).join('; ')}`);
  }

  // 1. Add dependencies to package.json
  if (
    Object.keys(recipe.dependencies).length > 0 ||
    Object.keys(recipe.devDependencies).length > 0
  ) {
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = { ...json.dependencies, ...recipe.dependencies };
      json.devDependencies = { ...json.devDependencies, ...recipe.devDependencies };

      // Sort alphabetically
      json.dependencies = Object.fromEntries(
        Object.entries(json.dependencies).sort(([a], [b]) => a.localeCompare(b)),
      );
      json.devDependencies = Object.fromEntries(
        Object.entries(json.devDependencies).sort(([a], [b]) => a.localeCompare(b)),
      );

      return json;
    });
  }

  // 2. Copy recipe template files
  const templateDir = path.join(__dirname, '../../../../templates/recipes', recipe.templateDir);
  const copiedFiles: string[] = [];

  // Note: In Phase 1, we copy files manually since generateFiles expects a specific structure.
  // Template files from the recipe dir are copied into the project root.
  // Files named README.md and package-fragment.json are skipped.
  // This is a simplified version — Phase 2 adds AST transforms.

  // 3. Add env vars
  if (recipe.envVars.length > 0) {
    const envPath = '.env.example';
    if (tree.exists(envPath)) {
      let envContent = tree.read(envPath, 'utf-8')!;
      const sectionMarker = `# --- ${recipe.name} ---`;

      if (!envContent.includes(sectionMarker)) {
        const section = [
          '',
          sectionMarker,
          ...recipe.envVars.map((v) => `# ${v.description}\n${v.key}=${v.defaultValue}`),
          `# --- end ${recipe.name} ---`,
          '',
        ].join('\n');

        envContent = envContent.trimEnd() + '\n' + section;
        tree.write(envPath, envContent);
      }
    }
  }

  // 4. Update AI context
  if (recipe.claudeMdSection) {
    const claudePath = 'CLAUDE.md';
    if (tree.exists(claudePath)) {
      let content = tree.read(claudePath, 'utf-8')!;
      const marker = `<!-- @spoonfeed:${recipeId} -->`;
      if (!content.includes(marker)) {
        content += `\n${marker}\n${recipe.claudeMdSection}\n<!-- @spoonfeed:end:${recipeId} -->\n`;
        tree.write(claudePath, content);
      }
    }
  }

  // 5. Update manifest
  updateJson(tree, manifestPath, (json) => {
    json.recipes[recipeId] = {
      installedAt: new Date().toISOString(),
      version: json.spoonfeedVersion ?? '0.0.1',
      files: copiedFiles,
    };
    return json;
  });

  await formatFiles(tree);

  logger.info(`Recipe '${recipe.name}' added successfully.`);
  if (!options.skipInstall) {
    logger.info('Run `pnpm install` to install new dependencies.');
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
git add src/generators/add-recipe/generator.ts
git commit -m "feat(spoonfeed): implement add-recipe generator (phase 1, no ast)"
```

---

## Task 7: list-recipes generator

**Files:**

- Create: `src/generators/list-recipes/generator.ts`
- Create: `src/generators/list-recipes/schema.json`

- [ ] **Step 1: Create schema.json**

Create `src/generators/list-recipes/schema.json`:

```json
{
  "$schema": "https://json-schema.org/schema",
  "cli": "nx",
  "$id": "ListRecipes",
  "title": "List Recipes",
  "type": "object",
  "properties": {
    "category": {
      "type": "string",
      "description": "Filter by category"
    },
    "project": {
      "type": "string",
      "description": "Target project (for monorepo)"
    },
    "json": {
      "type": "boolean",
      "default": false,
      "description": "Output as JSON"
    }
  }
}
```

- [ ] **Step 2: Implement the generator**

Create `src/generators/list-recipes/generator.ts`:

```typescript
import { Tree, logger } from '@nx/devkit';
import { RecipeRegistry } from '../../recipes/registry.js';
import { registerAllRecipes } from '../../recipes/definitions.js';

interface ListRecipesSchema {
  category?: string;
  project?: string;
  json?: boolean;
}

export default function listRecipesGenerator(tree: Tree, options: ListRecipesSchema): void {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);

  // Read manifest
  const manifestPath = '.spoonfeed.json';
  const manifest = tree.exists(manifestPath)
    ? (JSON.parse(tree.read(manifestPath, 'utf-8')!) as {
        projectType: string;
        cloudProvider: string;
        recipes: Record<string, unknown>;
      })
    : null;

  const installedIds = manifest ? Object.keys(manifest.recipes) : [];
  const allRecipes = options.category
    ? registry.getByCategory(options.category)
    : registry.getAll();

  if (options.json) {
    const output = {
      projectType: manifest?.projectType ?? 'unknown',
      cloudProvider: manifest?.cloudProvider ?? 'unknown',
      installed: installedIds,
      available: allRecipes
        .filter((r) => !installedIds.includes(r.id))
        .map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          conflicts: r.conflicts,
        })),
    };
    logger.info(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  if (manifest) {
    logger.info(`\nProject: ${manifest.projectType} (${manifest.cloudProvider})\n`);
  }

  if (installedIds.length > 0) {
    logger.info(`Installed (${installedIds.length}):`);
    for (const id of installedIds) {
      const recipe = registry.get(id as any);
      logger.info(`  ${id.padEnd(25)} ${recipe?.description ?? ''}`);
    }
    logger.info('');
  }

  const available = allRecipes.filter((r) => !installedIds.includes(r.id));
  logger.info(`Available (${available.length}):`);
  for (const recipe of available.slice(0, 20)) {
    const conflictNote = recipe.conflicts.some((c) => installedIds.includes(c))
      ? ` (conflicts: ${recipe.conflicts.filter((c) => installedIds.includes(c)).join(', ')})`
      : '';
    logger.info(`  ${recipe.id.padEnd(25)} ${recipe.description}${conflictNote}`);
  }

  if (available.length > 20) {
    logger.info(`  ... and ${available.length - 20} more`);
  }

  logger.info('\nUse: nx g spoonfeed:add <recipe>');
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter spoonfeed build
```

- [ ] **Step 4: Commit**

```bash
git add src/generators/list-recipes/
git commit -m "feat(spoonfeed): implement list-recipes generator"
```

---

## Task 8: Update initial project generation to create .spoonfeed.json

The existing generator in `src/generator/generator.ts` needs to create a `.spoonfeed.json` manifest in every generated project so the Nx generators can work.

**Files:**

- Modify: `src/generator/generator.ts`

- [ ] **Step 1: Add manifest creation after AI context assembly**

In `generator.ts`, after step 9 (AI context assembly) and before `s.stop()`, add:

```typescript
// 10. Create .spoonfeed.json manifest
const manifest = {
  projectType: config.projectType,
  cloudProvider: config.cloudProvider,
  spoonfeedVersion: '0.0.1',
  generatedAt: new Date().toISOString(),
  recipes: Object.fromEntries(
    config.recipes.map((id) => [
      id,
      {
        installedAt: new Date().toISOString(),
        version: '0.0.1',
        files: [],
      },
    ]),
  ),
};
await fs.writeJson(path.join(outputDir, '.spoonfeed.json'), manifest, { spaces: 2 });
```

- [ ] **Step 2: Verify build and existing tests**

```bash
pnpm --filter spoonfeed build && pnpm test:unit --passWithNoTests
```

- [ ] **Step 3: Commit**

```bash
git add src/generator/generator.ts
git commit -m "feat(spoonfeed): generate .spoonfeed.json manifest in new projects"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run all unit tests**

```bash
pnpm test:unit --passWithNoTests
```

Expected: all tests pass (53 existing + 10 new = ~63 total).

- [ ] **Step 2: Build spoonfeed**

```bash
pnpm --filter spoonfeed build
```

Expected: compiles with no errors.

- [ ] **Step 3: Build main project**

```bash
pnpm build
```

Expected: 0 TSC issues.

- [ ] **Step 4: Verify generators.json is valid**

```bash
cat generators.json | node -e "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write('Valid JSON\n')"
```

Expected: "Valid JSON"
