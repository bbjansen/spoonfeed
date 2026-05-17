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
cd nestjs-boilerplate-v1

# Install dependencies (also installs Git hooks via the prepare script)
pnpm install

# Start the development server
pnpm start:dev
```

---

## Development Workflow

| Command            | Description                           |
| ------------------ | ------------------------------------- |
| `pnpm start:dev`   | Start with file watching              |
| `pnpm start:debug` | Start with debugger attached          |
| `pnpm build`       | Compile to `dist/`                    |
| `pnpm lint`        | Lint and auto-fix source files        |
| `pnpm format`      | Format all source files with Prettier |
| `pnpm test`        | Run unit tests                        |
| `pnpm test:watch`  | Run tests in watch mode               |
| `pnpm test:cov`    | Run tests with coverage report        |
| `pnpm test:e2e`    | Run end-to-end tests                  |

### Path Aliases

The `@/*` alias maps to `src/*`. Use it for all internal imports to avoid brittle relative paths.

```ts
// Prefer this
import { UserService } from '@/users/user.service';

// Over this
import { UserService } from '../../users/user.service';
```

---

## Code Style

Formatting and linting are enforced automatically — you do not need to run them manually before committing.

### ESLint

Configuration lives in [`eslint.config.mjs`](eslint.config.mjs). It extends:

- `eslint:recommended`
- `typescript-eslint/recommended-type-checked`
- `eslint-plugin-prettier/recommended`

Run manually:

```bash
pnpm lint
```

### Prettier

Configuration lives in [`.prettierrc`](.prettierrc):

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

This project follows [GitLab Flow](https://about.gitlab.com/topics/version-control/what-is-gitlab-flow/). Branch names are validated automatically by [validate-branch-name](https://github.com/JsonMa/validate-branch-name) via Git hooks.

### Hooks

| Hook            | When it runs                 | Behaviour                                                                                         |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `post-checkout` | After every branch switch    | Prints a warning if the branch name is invalid — does not block work                              |
| `pre-push`      | Before pushing to the remote | **Blocks the push** if the branch name is invalid and the branch does not yet exist on the remote |

The `pre-push` hook only validates branches being pushed for the first time. If a branch already exists on the remote (e.g. it predates this convention), pushes to it are not blocked.

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
feature/PROJ-123/user-authentication
fix/PROJ-456/checkout-bug
hotfix/PROJ-789/critical-login-bug
chore/update-dependencies
docs/api-reference
refactor/AUTH-10/token-service
```

### Invalid Examples

```
feature/user Authentication   # uppercase and space in description
FEAT/user-authentication      # type must be lowercase
feature/user_authentication   # underscores not allowed in description
my-branch                     # no type prefix
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
- **scope** — optional, kebab-case noun describing the affected area (e.g. `auth`, `user-service`)
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
feat(auth)!: replace API key auth with OAuth 2.0

BREAKING CHANGE: API key headers are no longer accepted. Clients must use the OAuth 2.0 flow.
```

### Examples

```
feat(users): add user creation endpoint
fix(auth): handle token expiry on refresh
docs: update environment variable reference
refactor(leads): extract mapping logic into transformer
test(contacts): add edge cases for duplicate detection
chore: upgrade NestJS to v11
ci: add coverage threshold to pipeline
```

### What Gets Rejected

```
# No type
update the auth module

# Type not in the allowed list
hotfix: patch null reference

# Uppercase description
feat: Add OAuth integration

# Scope not in kebab-case
fix(AuthModule): resolve token issue
```

---

## Testing

### Layers

| Layer       | Scope                                | Location                | When it runs          |
| ----------- | ------------------------------------ | ----------------------- | --------------------- |
| Unit        | Single class in isolation            | `src/**/*.spec.ts`      | `pre-push` + pipeline |
| Integration | Module wired with real dependencies  | `src/**/*.spec.ts`      | `pre-push` + pipeline |
| E2E         | Full HTTP stack, request to response | `test/**/*.e2e-spec.ts` | Pipeline only         |

### File Structure

Tests live alongside the source files they cover using the `.spec.ts` suffix. E2E tests live in `test/`.

```
src/
  app/
    modules/
      users/
        users.service.ts
        users.service.spec.ts
test/
  users.e2e-spec.ts
```

### Rules

- **One spec file per source file** — if a file is worth writing, it is worth testing.
- **Unit test all service methods** — cover the happy path, edge cases, and error paths.
- **Mock only external dependencies** — databases, HTTP clients, and third-party SDKs. Never mock code you own.
- **Integration tests verify wiring** — use a real NestJS testing module with real providers to catch issues that unit tests miss.
- **E2E tests cover the HTTP boundary** — test the happy path and critical failure paths per endpoint. Exhaustive case coverage belongs in unit tests.
- **All unit and integration tests must pass before pushing** — enforced by the `pre-push` hook.
- **All tests must pass before a pull request can be merged** — enforced by the pipeline.

---

## Pull Requests

1. Branch from `main` following the [Branch Naming](#branch-naming) convention: `feature/PROJ-123/user-sync`, `fix/token-refresh`
2. Keep pull requests focused — one concern per PR
3. Ensure `pnpm test` and `pnpm build` pass locally before opening the PR
4. Fill out the PR description with a summary of the change and how to test it
