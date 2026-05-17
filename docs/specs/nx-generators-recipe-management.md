# Nx Generators for Recipe Management

## 1. Overview

This spec defines four Nx generators that manage recipes in existing projects:

- `nx g spoonfeeder:add <recipe>` -- add a recipe to a project
- `nx g spoonfeeder:remove <recipe>` -- remove a recipe from a project
- `nx g spoonfeeder:list` -- show installed and available recipes
- `nx g spoonfeeder:migrate --from <recipe> --to <recipe>` -- swap conflicting recipes

Each generator modifies source files (`app.module.ts`, `main.ts`), `package.json`, `.env.example`, and AI context files (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`). All changes are staged as a single Nx generator tree, so the user can preview them with `--dry-run` before applying.

---

## 2. Generator Types

### 2.1 add-recipe

**Command:** `nx g spoonfeeder:add swagger`

**Steps:**

1. Read `.spoonfeeder.json` to load current project state (project type, cloud provider, installed recipes).
2. Look up the `RecipeDefinition` from the recipe registry by ID.
3. Validate:
   - Recipe is compatible with the project type (`compatibleWith` field).
   - No mutual-exclusion conflicts with installed recipes (`conflicts` field).
   - All required recipes are already installed (`requires` field).
4. Copy template files from `packages/templates/recipes/<templateDir>/` into the project tree, processing EJS templates with project context.
5. Add `dependencies` and `devDependencies` to `package.json` (exact versions, no ranges).
6. Modify `src/app.module.ts`: add import statement and register the module in the `@Module.imports` array.
7. If the recipe has a `main.ts` setup snippet (e.g., Swagger, Fastify adapter), insert it into `src/main.ts` at the marked insertion point.
8. Append recipe env vars to `.env.example` under a section header.
9. Append `claudeMdSection` to `CLAUDE.md`, `cursorRules` to `.cursorrules`, `copilotInstructions` to `.github/copilot-instructions.md`.
10. Update `.spoonfeeder.json` to include the new recipe ID and timestamp.
11. Run `pnpm install` as a post-generation callback.

**Flags:**

| Flag          | Type    | Default | Description                          |
| ------------- | ------- | ------- | ------------------------------------ |
| `recipe`      | string  | --      | Recipe ID (positional, required)     |
| `project`     | string  | --      | Project name (for monorepo usage)    |
| `dryRun`      | boolean | false   | Preview changes without applying     |
| `skipInstall` | boolean | false   | Skip `pnpm install` after generation |

### 2.2 remove-recipe

**Command:** `nx g spoonfeeder:remove pino`

**Steps:**

1. Read `.spoonfeeder.json` and confirm the recipe is installed.
2. Check that no other installed recipe depends on this one via `requires`.
3. Remove recipe-specific files listed in the manifest's `files` array for this recipe.
4. Remove `dependencies` and `devDependencies` from `package.json`.
5. Modify `src/app.module.ts`: remove the import statement and the module reference from `@Module.imports`.
6. If the recipe modified `main.ts`, remove its marked block (delimited by `// --- <recipe-id> start ---` / `// --- <recipe-id> end ---`).
7. Remove the recipe's env vars section from `.env.example`.
8. Remove the recipe's section from `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`.
9. Update `.spoonfeeder.json` to remove the recipe ID.
10. Run `pnpm install` to clean up the lockfile.

**Flags:**

| Flag      | Type    | Default | Description                               |
| --------- | ------- | ------- | ----------------------------------------- |
| `recipe`  | string  | --      | Recipe ID (positional, required)          |
| `project` | string  | --      | Project name (for monorepo usage)         |
| `force`   | boolean | false   | Remove even if other recipes depend on it |
| `dryRun`  | boolean | false   | Preview changes without applying          |

### 2.3 list-recipes

**Command:** `nx g spoonfeeder:list`

**Output format:**

```
Project: my-api (http-api, aws)

Installed (4):
  swagger         API documentation with Swagger UI
  pino            Structured JSON logging with Pino
  health-checks   Health check endpoints
  typeorm-postgres TypeORM + PostgreSQL

Available (120+):
  prisma          Prisma ORM (conflicts: typeorm-postgres)
  winston         Winston logger (conflicts: pino)
  redis-cache     Redis caching layer
  ...

Use: nx g spoonfeeder:add <recipe>
```

**Flags:**

| Flag       | Type    | Default | Description                       |
| ---------- | ------- | ------- | --------------------------------- |
| `category` | string  | --      | Filter by category                |
| `project`  | string  | --      | Project name (for monorepo usage) |
| `json`     | boolean | false   | Output as JSON                    |

### 2.4 migrate-recipe

**Command:** `nx g spoonfeeder:migrate --from typeorm-postgres --to drizzle-postgres`

**Steps:**

1. Validate that `--from` is currently installed and `--to` is not.
2. Validate that `--from` and `--to` are in the same category (e.g., both are Database recipes).
3. Run the `remove-recipe` generator for `--from` (without `pnpm install`).
4. Run the `add-recipe` generator for `--to` (with `pnpm install`).
5. Print migration guidance to the console (e.g., "You will need to rewrite your entity files to use Drizzle schema syntax. See docs/recipes/database.md for migration guides.").

**Flags:**

| Flag      | Type    | Default | Description                       |
| --------- | ------- | ------- | --------------------------------- |
| `from`    | string  | --      | Recipe ID to remove (required)    |
| `to`      | string  | --      | Recipe ID to add (required)       |
| `project` | string  | --      | Project name (for monorepo usage) |
| `dryRun`  | boolean | false   | Preview changes without applying  |

---

## 3. Technical Architecture

```
packages/spoonfeeder/
  src/
    generators/
      add-recipe/
        generator.ts          # Main generator logic
        generator.spec.ts     # Unit tests
        schema.json           # Nx generator schema
        schema.d.ts           # TypeScript types for schema options
      remove-recipe/
        generator.ts
        generator.spec.ts
        schema.json
        schema.d.ts
      list-recipes/
        generator.ts
        generator.spec.ts
        schema.json
      migrate-recipe/
        generator.ts
        generator.spec.ts
        schema.json
        schema.d.ts
    utils/
      ast-transforms.ts       # ts-morph helpers for modifying source files
      ast-transforms.spec.ts
      recipe-manifest.ts      # Read/write .spoonfeeder.json
      recipe-manifest.spec.ts
      module-updater.ts       # Add/remove imports from app.module.ts
      module-updater.spec.ts
      main-ts-updater.ts      # Add/remove blocks from main.ts
      main-ts-updater.spec.ts
      env-updater.ts          # Add/remove sections from .env.example
      env-updater.spec.ts
      ai-context-updater.ts   # Add/remove sections from CLAUDE.md, .cursorrules, etc.
      ai-context-updater.spec.ts
    recipes/
      registry.ts             # Existing RecipeRegistry class (reused)
      definitions.ts          # Existing recipe definitions (reused)
    validation/
      conflict-detector.ts    # Existing conflict detector (reused)
  generators.json             # Nx generators entry point
```

**`generators.json`** (registered in `package.json` under `"generators"`):

```json
{
  "generators": {
    "add": {
      "factory": "./src/generators/add-recipe/generator",
      "schema": "./src/generators/add-recipe/schema.json"
    },
    "remove": {
      "factory": "./src/generators/remove-recipe/generator",
      "schema": "./src/generators/remove-recipe/schema.json"
    },
    "list": {
      "factory": "./src/generators/list-recipes/generator",
      "schema": "./src/generators/list-recipes/schema.json"
    },
    "migrate": {
      "factory": "./src/generators/migrate-recipe/generator",
      "schema": "./src/generators/migrate-recipe/schema.json"
    }
  }
}
```

---

## 4. Recipe Manifest (.spoonfeeder.json)

Tracks installed recipes and file ownership per project root. Created during initial project generation; maintained by generators thereafter.

```json
{
  "projectType": "http-api",
  "cloudProvider": "aws",
  "spoonfeederVersion": "0.0.1",
  "generatedAt": "2026-05-11T10:00:00Z",
  "recipes": {
    "swagger": {
      "installedAt": "2026-05-11T10:05:00Z",
      "version": "0.0.1",
      "files": ["src/infrastructure/swagger/swagger.config.ts"],
      "mainTsBlocks": ["swagger-setup"],
      "envSection": "Swagger",
      "moduleImport": {
        "moduleName": "SwaggerModule",
        "importPath": "@/infrastructure/swagger/swagger.module"
      }
    },
    "pino": {
      "installedAt": "2026-05-11T10:10:00Z",
      "version": "0.0.1",
      "files": [
        "src/infrastructure/logging/pino.config.ts",
        "src/infrastructure/logging/logging.module.ts"
      ],
      "mainTsBlocks": [],
      "envSection": "Pino Logging",
      "moduleImport": {
        "moduleName": "LoggingModule",
        "importPath": "@/infrastructure/logging/logging.module"
      }
    }
  }
}
```

**Key design decisions:**

- **File ownership tracking:** Each recipe records the files it created. The `remove-recipe` generator deletes only those files, avoiding accidental removal of user-modified shared files.
- **Module import metadata:** Stores the exact module name and import path so the `remove-recipe` generator can locate and remove the correct import statement and `@Module.imports` entry without brittle regex.
- **`mainTsBlocks`:** References to delimited code blocks in `main.ts` that belong to this recipe, enabling clean removal.
- **Version field:** Records which version of the recipe definition was used, enabling future upgrade generators.

---

## 5. AST Transforms (ts-morph)

All source file modifications use [ts-morph](https://ts-morph.com/) for type-safe AST manipulation. Raw string manipulation (regex, string replace) is explicitly avoided for `app.module.ts` and structured TypeScript files.

### 5.1 Adding a module import to app.module.ts

```typescript
import { Project, SyntaxKind, ObjectLiteralExpression } from 'ts-morph';

export function addModuleImport(filePath: string, moduleName: string, importPath: string): void {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);

  // Guard: skip if import already exists
  const existing = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === importPath,
  );
  if (existing) return;

  // Add import declaration
  sourceFile.addImportDeclaration({
    namedImports: [moduleName],
    moduleSpecifier: importPath,
  });

  // Find the AppModule class and its @Module decorator
  const appModuleClass = sourceFile.getClasses().find((c) => c.getDecorator('Module'));
  if (!appModuleClass) throw new Error('No class with @Module decorator found');

  const moduleDecorator = appModuleClass.getDecorator('Module')!;
  const args = moduleDecorator.getArguments();
  if (args.length === 0) throw new Error('@Module decorator has no arguments');

  const objectLiteral = args[0] as ObjectLiteralExpression;
  const importsProp = objectLiteral.getProperty('imports');

  if (importsProp) {
    // Append to existing imports array
    const initializer = importsProp.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    initializer.addElement(moduleName);
  } else {
    // Create imports array if it doesn't exist
    objectLiteral.addPropertyAssignment({
      name: 'imports',
      initializer: `[${moduleName}]`,
    });
  }

  sourceFile.formatText();
  sourceFile.saveSync();
}
```

### 5.2 Removing a module import from app.module.ts

```typescript
export function removeModuleImport(filePath: string, moduleName: string, importPath: string): void {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);

  // Remove import declaration
  const importDecl = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === importPath,
  );
  importDecl?.remove();

  // Remove from @Module imports array
  const appModuleClass = sourceFile.getClasses().find((c) => c.getDecorator('Module'));
  if (!appModuleClass) return;

  const moduleDecorator = appModuleClass.getDecorator('Module')!;
  const objectLiteral = moduleDecorator.getArguments()[0] as ObjectLiteralExpression;
  const importsProp = objectLiteral.getProperty('imports');
  if (!importsProp) return;

  const initializer = importsProp.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
  const element = initializer.getElements().find((e) => e.getText() === moduleName);
  element?.remove();

  sourceFile.formatText();
  sourceFile.saveSync();
}
```

### 5.3 main.ts block insertion

For recipes that require `main.ts` changes (Swagger, Fastify adapter, etc.), the generator inserts delimited blocks:

```typescript
// --- swagger-setup start ---
const swaggerConfig = new DocumentBuilder()
  .setTitle('API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api/docs', app, document);
// --- swagger-setup end ---
```

Removal finds and strips everything between the start/end markers, inclusive.

---

## 6. Generator Schema (schema.json)

### add-recipe/schema.json

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
      "description": "Target project (for monorepo)",
      "x-prompt": "Which project? (leave empty for root)"
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

### remove-recipe/schema.json

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

---

## 7. Integration with Existing System

The generators reuse everything that already exists in `packages/spoonfeeder/`:

| Existing artifact                                    | Used by generators for                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `RecipeDefinition` (types.ts)                        | Recipe metadata: deps, env vars, conflicts, template dir     |
| `RecipeRegistry` (recipes/registry.ts)               | Looking up recipes by ID, filtering by project type/category |
| `detectConflicts` (validation/conflict-detector.ts)  | Validating that `add-recipe` won't introduce conflicts       |
| `RECIPE_IDS` (types.ts)                              | Type-safe recipe ID validation at compile time               |
| `ProjectConfig` (types.ts)                           | Type definition for `.spoonfeeder.json` core fields          |
| Template directories (`packages/templates/recipes/`) | Source files copied into the target project                  |

The generators do NOT duplicate recipe metadata. A single `RecipeDefinition` entry in `definitions.ts` drives both initial project generation and post-hoc recipe management.

---

## 8. Implementation Phases

### Phase 1: Foundation (add-recipe + list-recipes, no AST)

- Implement `.spoonfeeder.json` manifest read/write (`recipe-manifest.ts`).
- Implement `list-recipes` generator: reads manifest + registry, prints table.
- Implement `add-recipe` generator with file copying and `package.json` modification only.
- Add env var appending to `.env.example`.
- Add AI context file updates (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`).
- Unit tests for manifest operations and env/context updaters.

**Deliverable:** Users can add recipes that don't require `app.module.ts` changes (e.g., `devcontainer`, `changelog`, `license`, `docker-compose-dev`).

### Phase 2: AST transforms (app.module.ts + main.ts)

- Implement `ast-transforms.ts` with `addModuleImport` and `removeModuleImport`.
- Implement `main-ts-updater.ts` with block insertion/removal.
- Integrate AST transforms into `add-recipe` generator.
- Snapshot tests: given an input `app.module.ts`, assert the output matches after adding a recipe.

**Deliverable:** Full `add-recipe` support for all recipe types including those requiring module registration and `main.ts` setup.

### Phase 3: remove-recipe with manifest tracking

- Implement `remove-recipe` generator using manifest file lists and AST removal.
- Add dependency checking (prevent removing a recipe that others depend on).
- Integration tests: add then remove a recipe, verify the project returns to its original state.

**Deliverable:** Complete add/remove lifecycle.

### Phase 4: migrate-recipe

- Implement `migrate-recipe` as an orchestrator over `remove-recipe` + `add-recipe`.
- Add category validation (only allow migration within the same recipe category).
- Add migration guidance messages per recipe pair (stored alongside recipe definitions).
- E2E test: migrate `typeorm-postgres` to `drizzle-postgres`, verify project builds.

**Deliverable:** One-command recipe swaps with actionable migration guidance.

---

## 9. Testing Strategy

### Unit tests (co-located `.spec.ts` files)

- **AST transforms:** Feed in a minimal `app.module.ts` source string, run `addModuleImport`/`removeModuleImport`, assert the output source matches the expected string. Test edge cases: empty imports array, no imports property, duplicate guard, `ConfigModule.forRoot()` call expressions in imports.
- **Manifest operations:** Create/read/update `.spoonfeeder.json`, verify schema integrity.
- **Env updater:** Add a section, remove a section, verify idempotency (adding twice doesn't duplicate).
- **AI context updater:** Same add/remove/idempotency tests for `CLAUDE.md` sections.

### Integration tests

- Use `@nx/devkit/testing` `createTreeWithEmptyWorkspace()` to create a virtual file tree.
- Run the `add-recipe` generator against the tree, assert expected files exist and `package.json` contains the right dependencies.
- Run `remove-recipe` after `add-recipe`, assert the tree is clean (no leftover files or imports).

### Snapshot tests

- Capture full file output of `app.module.ts` after adding 1, 2, and 3 recipes.
- Capture `main.ts` output after adding Swagger.
- These snapshots guard against regressions in formatting or import ordering.

### E2E tests

- Generate a full project, run `add-recipe swagger`, run `pnpm build`, assert exit code 0.
- Run `remove-recipe swagger`, run `pnpm build` again, assert exit code 0.

---

## 10. Open Questions

1. **Standalone vs. monorepo:** Should generators work without Nx installed (e.g., via `npx`)? If so, the generators need a standalone runner that doesn't depend on `nx.json` or workspace configuration. Recommendation: support both by detecting whether `nx.json` exists and falling back to a lightweight runner.

2. **main.ts modification strategy:** The delimited block approach (`// --- <id> start/end ---`) works for additive setup code (Swagger, compression, helmet). But some recipes require wrapping the entire bootstrap (e.g., Fastify adapter replaces `NestFactory.create` call). Recommendation: use a slot-based system in the generated `main.ts` template with named insertion points (`// @spoonfeeder:adapter`, `// @spoonfeeder:before-listen`, `// @spoonfeeder:after-create`).

3. **File ownership granularity:** The current manifest tracks files at the path level. If two recipes both contribute to the same file (e.g., both add a middleware), removal becomes ambiguous. Recommendation: for shared files, track at the block/section level using the same delimiter pattern as `main.ts`. For recipe-exclusive files, track at the file level.

4. **Recipe version upgrades:** When a recipe definition changes (new dependency version, new env var), how do installed recipes get updated? This is out of scope for this spec but should be addressed in a future `upgrade-recipe` generator.

5. **Interactive mode:** Should `add-recipe` prompt for recipe-specific configuration (e.g., Swagger base path, database name)? Recommendation: yes, via `x-prompt` in per-recipe schema extensions, but defer to Phase 2+ to keep Phase 1 simple.
