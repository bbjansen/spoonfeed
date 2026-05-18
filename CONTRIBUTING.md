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

## Test Structure

Tests live in the `tests/` directory, mirroring the `src/` layout:

- **`tests/unit/`** -- Unit tests (`*.spec.ts`). One file per source file, mocking only external dependencies.
- **`tests/integration/`** -- Integration tests (`*.integration.spec.ts`). Use real providers and Testcontainers where applicable.
- **`tests/e2e/`** -- End-to-end tests (`*.e2e-spec.ts`). HTTP boundary tests against a running app.
- **`tests/factories/`** -- Shared test data builders used across all suites.

## Code Style

Formatting and linting are enforced automatically via lint-staged on commit. You do not need to run them manually.

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Reporting Issues

Open an issue at <https://github.com/bbjansen/spoonfeed/issues> with a clear description and steps to reproduce.
