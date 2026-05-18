# Contributing

Contributions are welcome. Follow the steps below to get started.

## Getting Started

1. Fork the repository and clone your fork.
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Make your changes.
5. Run the full test suite:
   ```bash
   pnpm test:all
   ```
6. Push your branch and open a pull request against `main`.

## Project Structure

```
spoonfeed/
├── src/                          # CLI source code
│   ├── index.ts                  # Entry point
│   ├── types.ts                  # Shared types (ProjectType, RecipeId, RecipeDefinition, etc.)
│   ├── generator/                # Project generator (template engine, mergers)
│   ├── generators/               # Nx generators (add, remove, migrate recipes)
│   ├── prompts/                  # Interactive CLI prompts (@clack/prompts)
│   ├── recipes/                  # Recipe system
│   │   ├── definitions.ts        # All recipe definitions (dependencies, env vars, conflicts)
│   │   ├── registry.ts           # RecipeRegistry class (lookup, filtering, compatibility)
│   │   └── recipe.interface.ts   # Recipe interface
│   ├── utils/                    # Utilities (AST transforms, env/module updaters)
│   └── validation/               # Config validation and conflict detection
├── templates/                    # Template files copied into generated projects
│   ├── base/                     # Base template included in every project
│   │   └── src/shared/           # Errors, filters, interceptors, pipes, constants
│   ├── project-types/            # Per-project-type overrides (http-api, microservice, etc.)
│   └── recipes/                  # One directory per recipe (86 recipe templates)
├── tests/                        # All test suites
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── e2e/                      # End-to-end tests
├── site-docs/                    # Documentation site (MkDocs Material)
├── docs/                         # Architecture and standards docs
├── jest.config.ts                # Jest config with three projects (unit, integration, e2e)
├── mkdocs.yml                    # MkDocs site configuration
└── package.json                  # Scripts, dependencies, bin entry
```

## Adding a New Recipe

Recipes are the core extension mechanism. Each recipe adds a self-contained feature (database driver, auth strategy, observability tool, etc.) to a generated project. Follow these steps to contribute a new one.

### 1. Add the recipe ID to the type system

Open `src/types.ts` and add your recipe ID to the `RECIPE_IDS` array. Place it in the appropriate section (alphabetical within its group):

```typescript
export const RECIPE_IDS = [
  // ...existing IDs...
  'your-recipe',
] as const;
```

This makes the ID available as a valid `RecipeId` type throughout the codebase.

### 2. Add the recipe definition

Open `src/recipes/definitions.ts` and add a `RecipeDefinition` object to the `recipes` array. Every field is required:

```typescript
{
  id: 'your-recipe',
  name: 'Your Recipe',
  description: 'One-line description of what this recipe adds',
  category: 'Database',           // Database, Auth, Security, Observability, API, etc.
  dependencies: {
    'some-package': '1.2.3',      // Exact versions only -- no ^ or ~
  },
  devDependencies: {},
  envVars: [
    { key: 'YOUR_VAR', defaultValue: 'value', description: 'What this var controls' },
  ],
  conflicts: ['incompatible-recipe'],  // Recipe IDs that cannot coexist
  requires: [],                         // Recipe IDs that must also be selected
  compatibleWith: 'all',                // Or a list of ProjectType values
  templateDir: 'your-recipe',           // Must match the directory name under templates/recipes/
  claudeMdSection: 'Instructions for CLAUDE.md in the generated project.',
  cursorRules: 'Instructions for .cursor/rules/project.mdc in the generated project.',
  copilotInstructions: 'Instructions for .github/copilot-instructions.md.',
}
```

### 3. Create the template directory

Create a directory at `templates/recipes/your-recipe/` with the files your recipe adds to the generated project. Follow the existing directory convention:

```
templates/recipes/your-recipe/
├── README.md                     # Documents what this recipe provides
├── src/                          # Source files merged into the generated project
│   └── infrastructure/           # or app/modules/, shared/, etc.
│       └── your-feature/
│           └── your-feature.module.ts
└── tests/                        # Test scaffolds
    └── unit/
        └── infrastructure/
            └── your-feature/
```

The directory structure under `src/` mirrors the generated project layout. Files are copied into the output during generation.

### 4. Add tests

Add tests covering your recipe at three levels:

- **Unit tests** (`tests/unit/recipes/`): Verify the recipe definition is valid — correct conflicts, required dependencies present, `templateDir` matches an actual directory.
- **Integration tests** (`tests/integration/`): Run the generator with your recipe selected and verify the output project contains the expected files, dependencies, and configuration.
- **E2e tests** (`tests/e2e/`): If your recipe adds CLI behavior, verify it works end-to-end.

At minimum, run the existing test suite to confirm nothing breaks:

```bash
pnpm test:all
```

### 5. Update the documentation

- Add your recipe to the appropriate category page under `site-docs/recipes/`.
- If your recipe implements an RFC or standard, add it to `site-docs/architecture/standards.md`.
- Build the docs to verify: `mkdocs build`.

## Running Tests

The project uses [Jest](https://jestjs.io/) with three test tiers configured as separate Jest projects in `jest.config.ts`.

### Unit tests

Fast, isolated tests that verify individual functions and classes. External dependencies (filesystem, network) are mocked. One spec file per source file.

```bash
pnpm test:unit
```

- **Location:** `tests/unit/`
- **File pattern:** `*.spec.ts`
- **Timeout:** Default (5 seconds)

### Integration tests

Tests that exercise the generator with real file I/O. These create temporary output directories, run the full generation pipeline, and verify the resulting project structure. Slower than unit tests.

```bash
pnpm test:integration
```

- **Location:** `tests/integration/`
- **File pattern:** `*.integration.spec.ts`
- **Timeout:** 30 seconds

### End-to-end tests

Full CLI tests that invoke the binary and verify the complete workflow from prompts to output. These are the slowest tests and are primarily used for smoke testing releases.

```bash
pnpm test:e2e
```

- **Location:** `tests/e2e/`
- **File pattern:** `*.e2e.spec.ts`
- **Timeout:** 120 seconds (2 minutes)

### Running everything

```bash
pnpm test:all
```

The `pnpm test` command (without a suffix) runs unit tests only, which is the fastest feedback loop during development.

## Code Style

Formatting and linting are enforced automatically via lint-staged on commit. You do not need to run them manually.

The Prettier configuration (`.prettierrc`):

| Setting | Value |
| --- | --- |
| Single quotes | `true` |
| Semicolons | `true` |
| Print width | `100` |
| Tab width | `2` |
| Trailing commas | `all` |
| End of line | `lf` |

If you want to format or lint manually:

```bash
pnpm format        # Run Prettier on src/ and tests/
pnpm lint          # Run ESLint with --fix on src/ and tests/
```

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scope:** Optional, kebab-case (e.g., `auth`, `user-service`)

**Description:** Lowercase, imperative tense, no trailing period, max 100 characters

### Examples

```
feat(recipes): add redis cache recipe
fix(generator): resolve template path for monorepo type
docs(architecture): update directory structure diagram
test(auth): add unit tests for JWT strategy
```

## Branch Naming

Format: `{type}/{description}` or `{type}/{TICKET_NUMBER}/{description}`

- Allowed types: `feature`, `fix`, `hotfix`, `release`, `chore`, `docs`, `refactor`, `test`
- Description: lowercase, digits, hyphens only

Examples: `feature/add-redis-recipe`, `fix/template-path-resolution`

## Reporting Issues

Open an issue at [github.com/bbjansen/spoonfeed/issues](https://github.com/bbjansen/spoonfeed/issues) with a clear description and steps to reproduce.
