# Contributing

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Branch Naming](#branch-naming)
- [Commits](#commits)
- [Testing](#testing)
- [Pull Requests](#pull-requests)

---

## Prerequisites

- [Node.js](https://nodejs.org/) (see `.nvmrc` or `engines` field in `package.json` for version)
- [pnpm](https://pnpm.io/) — used as the package manager
- [Git](https://git-scm.com/)

---

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd spoonfeed

# Install dependencies
pnpm install

# Build the CLI
pnpm build

# Run the scaffolder
pnpm create-spoonfeed
```

---

## Development Workflow

| Command              | Description                           |
| -------------------- | ------------------------------------- |
| `pnpm build`         | Compile TypeScript to `dist/`         |
| `pnpm dev`           | Compile in watch mode                 |
| `pnpm create-spoonfeed` | Run the scaffolder CLI           |
| `pnpm lint`          | Lint and auto-fix source files        |
| `pnpm format`        | Format all source files with Prettier |
| `pnpm test`          | Run unit tests                        |
| `pnpm test:unit`     | Run unit tests (explicit)             |
| `pnpm test:integration` | Run integration tests              |
| `pnpm test:e2e`      | Run end-to-end tests                  |
| `pnpm test:all`      | Run all test suites                   |

### Path Aliases

The `@spoonfeed/` alias maps to `src/`. Use it for all internal imports to avoid brittle relative paths.

```ts
// Prefer this
import { runAllPrompts } from '@spoonfeed/prompts/run-all';

// Over this
import { runAllPrompts } from '../../prompts/run-all';
```

---

## Code Style

Formatting and linting are enforced automatically — you do not need to run them manually before committing.

### Prettier

Configuration lives in [`.prettierrc`](../.prettierrc):

| Option          | Value  |
| --------------- | ------ |
| `singleQuote`   | `true` |
| `semi`          | `true` |
| `printWidth`    | `100`  |
| `tabWidth`      | `2`    |
| `trailingComma` | `all`  |
| `endOfLine`     | `lf`   |

Run manually:

```bash
pnpm format
```

### Pre-commit Hook

On every commit, [lint-staged](https://github.com/lint-staged/lint-staged) runs automatically against staged files:

- **`.ts` / `.tsx`** — ESLint (auto-fix) + Prettier
- **`.json` / `.md` / `.yml` / `.yaml`** — Prettier

---

## Branch Naming

Branch names are validated automatically via Git hooks.

### Format

```
{type}/{TICKET_NUMBER}/{description}
{type}/{description}
```

| Segment         | Required | Rules                                               |
| --------------- | -------- | --------------------------------------------------- |
| `type`          | Yes      | One of the allowed types below                      |
| `TICKET_NUMBER` | No       | Uppercase letters, hyphen, digits — e.g. `PROJ-123` |
| `description`   | Yes      | Lowercase letters, digits, and hyphens only         |

### Allowed Types

`feature` `fix` `hotfix` `release` `chore` `docs` `refactor` `test`

### Exempt Branches

`main`, `staging`, and `production` bypass validation entirely.

### Valid Examples

```
feature/PROJ-123/add-prisma-recipe
fix/PROJ-456/template-copy-bug
chore/update-dependencies
docs/recipe-guide
refactor/AUTH-10/token-service
```

---

## Commits

This project enforces [Conventional Commits](https://www.conventionalcommits.org/). Every commit message is validated by [commitlint](https://commitlint.js.org/) on the `commit-msg` hook.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

- **type** — required, must be one of the types listed below
- **scope** — optional, kebab-case noun describing the affected area (e.g. `recipes`, `generator`)
- **description** — short summary in lowercase, imperative tense, no trailing period, max 100 characters
- **body** — additional context, separated from the description by a blank line, max 100 characters per line
- **footer** — issue references or breaking change notices, separated from the body by a blank line

### Types

| Type       | When to use                                          |
| ---------- | ---------------------------------------------------- |
| `feat`     | A new feature                                        |
| `fix`      | A bug fix                                            |
| `docs`     | Documentation changes only                           |
| `style`    | Formatting, whitespace — no logic change             |
| `refactor` | Code restructuring with no feature or bug change     |
| `perf`     | A change that improves performance                   |
| `test`     | Adding or correcting tests                           |
| `build`    | Changes to the build system or external dependencies |
| `ci`       | Changes to CI/CD configuration                       |
| `chore`    | Maintenance tasks not affecting source or test files |
| `revert`   | Reverts a previous commit                            |

### Breaking Changes

Append `!` after the type/scope and add a `BREAKING CHANGE:` footer:

```
feat(recipes)!: change recipe manifest schema

BREAKING CHANGE: `conflictsWith` field renamed to `incompatibleWith` in all recipe manifests.
```

### Examples

```
feat(recipes): add prisma recipe
fix(generator): handle missing template directory gracefully
docs: update recipe authoring guide
refactor(prompts): extract validation into separate module
test(generator): add edge cases for template copy
chore: upgrade typescript to 5.9
```

---

## Testing

### Layers

| Layer       | Scope                                | Location                             | When it runs          |
| ----------- | ------------------------------------ | ------------------------------------ | --------------------- |
| Unit        | Single class or function in isolation | `tests/unit/**/*.spec.ts`            | `pre-push` + pipeline |
| Integration | Module wired with real dependencies  | `tests/integration/**/*.spec.ts`     | `pre-push` + pipeline |
| E2E         | Full scaffolder run, file output     | `tests/e2e/**/*.spec.ts`             | Pipeline only         |

### File Structure

```
tests/
  unit/           # mirrors src/ structure
  integration/    # full module wiring
  e2e/            # scaffolder end-to-end runs
  factories/      # shared test data builders
```

### Rules

- **One spec file per source file** — if a file is worth writing, it is worth testing.
- **Unit test all exported functions and methods** — cover the happy path, edge cases, and error paths.
- **Mock only external dependencies** — filesystem, network, third-party SDKs. Never mock code you own.
- **Integration tests verify wiring** — test full modules with real providers to catch issues unit tests miss.
- **E2E tests verify scaffolder output** — run the full generation and assert on emitted files.
- **All unit and integration tests must pass before pushing** — enforced by the `pre-push` hook.
- **All tests must pass before a pull request can be merged** — enforced by the pipeline.

---

## Pull Requests

1. Branch from `main` following the [Branch Naming](#branch-naming) convention
2. Keep pull requests focused — one concern per PR
3. Ensure `pnpm test` and `pnpm build` pass locally before opening the PR
4. Fill out the PR description with a summary of the change and how to test it
