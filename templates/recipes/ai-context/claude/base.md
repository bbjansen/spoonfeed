# CLAUDE.md

## Package Manager

Always use **pnpm**. Never use npm or yarn.

## Imports

Use the `@/*` alias for all internal imports — it maps to `src/*`.

```ts
// correct
import { UserService } from '@/users/user.service';

// wrong
import { UserService } from '../../users/user.service';
```

## Code Style

Formatting and linting are enforced automatically by lint-staged on commit. Do not run `pnpm lint` or `pnpm format` manually unless explicitly asked.

Prettier config (`.prettierrc`): single quotes, semicolons, print width 100, tab width 2, trailing commas, LF line endings.

## Branch Naming

Format: `{type}/{TICKET_NUMBER}/{description}` or `{type}/{description}`

- Allowed types: `feature` `fix` `hotfix` `release` `chore` `docs` `refactor` `test`
- Description: lowercase, digits, hyphens only — no spaces or underscores
- Ticket number: optional, uppercase letters + hyphen + digits (e.g. `PROJ-123`)
- Exempt branches: `main`, `staging`, `production`

Examples: `feature/PROJ-123/user-authentication`, `fix/token-refresh`, `chore/update-dependencies`

## Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/). commitlint enforces this on every commit.

```
<type>(<scope>): <description>
```

- **type**: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- **scope**: optional, kebab-case (e.g. `auth`, `user-service`)
- **description**: lowercase, imperative tense, no trailing period, max 100 characters

Breaking changes: append `!` after type/scope and add a `BREAKING CHANGE:` footer.

## Testing

- Tests live in `tests/` at the project root, mirroring the `src/` structure
- Unit tests: `tests/unit/` — one `.spec.ts` per source file
- Integration tests: `tests/integration/` — uses Testcontainers, suffix `.integration.spec.ts`
- E2E tests: `tests/e2e/` — HTTP boundary tests, suffix `.e2e-spec.ts`
- Test factories: `tests/factories/` — shared test data builders
- Unit test all service methods — happy path, edge cases, and error paths
- **Mock only external dependencies** (databases, HTTP clients, third-party SDKs) — never mock code you own
- Integration tests use a real NestJS testing module with real providers
- Unit tests and type checking must pass before pushing (`pre-push` hook)

## Key Commands

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `pnpm start:dev`        | Start with file watching                   |
| `pnpm build`            | Compile to `dist/`                         |
| `pnpm test`             | Run unit tests                             |
| `pnpm test:unit`        | Run unit tests (explicit)                  |
| `pnpm test:integration` | Run integration tests (Testcontainers)     |
| `pnpm test:e2e`         | Run end-to-end tests                       |
| `pnpm test:all`         | Run all test suites                        |
| `pnpm test:cov`         | Run unit + integration tests with coverage |
