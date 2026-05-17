# ADR-028: Code Quality Toolchain (ESLint, Prettier, Commitlint, Husky)

## Status

Accepted

## Date

2026-05-01

## Context

Code quality enforcement via manual review is inconsistent and slow. Automated tooling must catch formatting, lint, commit message, and type errors before code reaches the remote. The toolchain must be fast enough that developers do not bypass it.

## Decision

Use a layered git hook pipeline with ESLint flat config, Prettier, commitlint, lint-staged, and husky:

### Pre-commit (lint-staged)

- **ESLint** on staged `.ts` files (flat config) + **Prettier** on staged files (TS, JSON, YAML, MD)
- lint-staged processes only staged files, keeping the hook under 5 seconds

### Commit-msg (commitlint)

- Enforces Conventional Commits: `<type>(<scope>): <description>`, kebab-case scope, lowercase description

### Pre-push

- `tsc --noEmit` + `pnpm test` — type-check and unit tests must pass
- Branch name validation enforces naming convention (`feature/`, `fix/`, `chore/`, etc.)

## Consequences

### Positive

- Zero formatting debates — Prettier is the single source of truth
- Consistent commit history enables automated changelog generation and semantic versioning
- Type errors and test failures caught before push prevent broken CI builds

### Negative

- Five tools to configure; pre-push hook adds 10-30 seconds that developers may perceive as friction

### Risks

- Developers bypassing hooks with `--no-verify` — mitigated by CI running the same checks, so bypassed commits fail in pipeline

## Alternatives Considered

### Biome (formerly Rome)

- **Pros:** single tool for linting and formatting, faster than ESLint + Prettier
- **Cons:** smaller plugin ecosystem, no commitlint equivalent
- **Why not:** ESLint's plugin ecosystem (TypeORM, NestJS-specific rules) is essential

## References

- ADR-009: Standards Compliance
- Packages: `eslint`, `prettier`, `@commitlint/cli`, `lint-staged`, `husky`
