# Monorepo Project Type

## When to Use

Choose `monorepo` when you have multiple applications or libraries that share code and need coordinated development. Common scenarios: a suite of microservices, an API with a shared SDK, or multiple apps sharing domain models and utilities.

Not ideal for a single standalone service or when teams need fully independent deployment cycles with no shared code.

## Nx Workspace Structure

The scaffolder generates an Nx-powered workspace:

```
my-workspace/
  apps/
    api/                     # NestJS HTTP API
      src/
      project.json
    worker/                  # Background worker
      src/
      project.json
  libs/
    shared/
      domain/               # Domain models, interfaces
        src/
        project.json
      utils/                 # Common utilities
        src/
        project.json
      database/              # Database entities, migrations
        src/
        project.json
  nx.json                    # Nx configuration
  tsconfig.base.json         # Shared TypeScript config
  package.json
```

### Key Files

| File                 | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `nx.json`            | Task runner config, caching, default settings  |
| `project.json`       | Per-project targets (build, test, lint, serve) |
| `tsconfig.base.json` | Shared compiler options and path aliases       |

## Shared Libraries

### Creating a Library

```bash
pnpm nx generate @nx/js:library --name=domain --directory=libs/shared/domain
```

### Using a Library in an App

Libraries are referenced via TypeScript path aliases defined in `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@workspace/domain": ["libs/shared/domain/src/index.ts"],
      "@workspace/utils": ["libs/shared/utils/src/index.ts"],
      "@workspace/database": ["libs/shared/database/src/index.ts"]
    }
  }
}
```

Import in application code:

```typescript
import { Order, OrderStatus } from '@workspace/domain';
import { formatCurrency } from '@workspace/utils';
```

### Library Best Practices

- Each library has a single `index.ts` barrel file that controls its public API
- Keep libraries focused on one domain area
- Avoid circular dependencies between libraries
- Use `nx graph` to visualize and validate the dependency graph

## Task Caching and Affected Commands

### Task Caching

Nx caches build, test, and lint results. Subsequent runs skip unchanged projects.

```bash
# First run: executes all tests
pnpm nx run-many -t test

# Second run (no changes): instant, served from cache
pnpm nx run-many -t test
```

Configure cacheable targets in `nx.json`:

```json
{
  "targetDefaults": {
    "build": { "cache": true, "dependsOn": ["^build"] },
    "test": { "cache": true },
    "lint": { "cache": true }
  }
}
```

### Affected Commands

Only run tasks for projects affected by recent changes:

```bash
# Test only projects affected since main
pnpm nx affected -t test

# Build only affected projects
pnpm nx affected -t build

# Lint only affected projects
pnpm nx affected -t lint
```

This is especially useful in CI to avoid running the full test suite on every commit.

### Run Multiple Targets

```bash
# Run lint, test, and build across all projects
pnpm nx run-many -t lint test build

# Run for specific projects
pnpm nx run-many -t build --projects=api,worker
```

## Adding New Apps

### Add a NestJS Application

```bash
pnpm nx generate @nx/nest:application --name=notification-service --directory=apps/notification-service
```

### Add a Library

```bash
pnpm nx generate @nx/js:library --name=notifications --directory=libs/shared/notifications
```

### Verify the Dependency Graph

```bash
# Open interactive graph in browser
pnpm nx graph

# Check for circular dependencies
pnpm nx lint
```

### Common Commands

| Command                    | Description                   |
| -------------------------- | ----------------------------- |
| `pnpm nx serve api`        | Start the API with hot reload |
| `pnpm nx build api`        | Build the API for production  |
| `pnpm nx test api`         | Run API unit tests            |
| `pnpm nx run-many -t test` | Test all projects             |
| `pnpm nx affected -t test` | Test affected projects only   |
| `pnpm nx graph`            | Visualize dependency graph    |
| `pnpm nx reset`            | Clear Nx cache                |
