# ADR-012: Nx for Monorepo and Full-Stack Project Types

## Status

Accepted

## Date

2026-04-01

## Context

Monorepo and full-stack project types need workspace management: shared libraries, task orchestration, dependency graph awareness, and caching.

Options: pnpm workspaces only, Nx, Turborepo, Lerna.

## Decision

Use Nx with pnpm workspaces for monorepo and full-stack project types.

## Consequences

### Positive

- First-class NestJS plugin (`@nx/nest`) with generators matching NestJS schematics
- Task caching (local + remote) saves CI time as the workspace grows
- `nx affected` runs only changed projects
- Dependency graph visualization (`nx graph`)

### Negative

- Additional learning curve for teams unfamiliar with Nx
- Nx adds ~50MB to node_modules
- Configuration overhead for small projects

### Alternatives Considered

#### pnpm workspaces only

- **Pros:** Minimal tooling, no extra dependencies
- **Cons:** No task caching, no dependency graph, no affected commands
- **Why not:** Missing features that matter at scale (5+ packages)

#### Turborepo

- **Pros:** Simpler than Nx, good task caching
- **Cons:** Less NestJS-specific tooling, no generators
- **Why not:** Nx has better NestJS integration

#### Lerna

- **Pros:** Well-known
- **Cons:** Now powered by Nx under the hood, adds an unnecessary layer
- **Why not:** Just use Nx directly
