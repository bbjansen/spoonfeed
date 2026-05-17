# ADR-027: Dependency Management with pnpm

## Status

Accepted

## Date

2026-05-01

## Context

Node.js package managers (npm, yarn, pnpm) differ significantly in installation speed, disk usage, dependency resolution strictness, and monorepo support. The boilerplate needs a package manager that supports the monorepo workspace layout (ADR-012), enforces strict dependency boundaries, and prevents phantom dependencies.

## Decision

Use **pnpm** as the sole package manager for all projects scaffolded by the boilerplate. Key design choices:

- **Strict mode:** pnpm's default content-addressable store and symlink-based `node_modules` prevent phantom dependencies (packages that work by accident because a transitive dependency hoisted them)
- **Exact versions:** `.npmrc` includes `save-exact=true` so `pnpm add` writes exact versions (e.g., `4.18.2` not `^4.18.2`), preventing unexpected minor/patch updates
- **Workspace support:** `pnpm-workspace.yaml` defines the monorepo package topology; `workspace:*` protocol for internal package references
- **Lockfile integrity:** `pnpm-lock.yaml` is committed and CI runs `pnpm install --frozen-lockfile` to ensure reproducible installs
- **Automated updates:** Renovate or Dependabot configuration is provided as a recipe, configured to open PRs with exact version bumps on a weekly schedule
- **Security auditing:** pre-push hook runs `pnpm audit --audit-level=high` to catch known vulnerabilities before code reaches the remote

## Consequences

### Positive

- Content-addressable store saves disk space via shared package cache across projects
- Strict `node_modules` layout catches missing `dependencies` declarations that npm/yarn silently resolve
- Exact versions eliminate drift between development, CI, and production environments

### Negative

- Some packages with native bindings may need `pnpm.overrides` or `pnpm.patchedDependencies`
- Developers accustomed to npm/yarn need to adopt pnpm-specific commands

### Risks

- pnpm adoption is lower than npm — mitigated by pnpm's growing ecosystem support and corepack integration in Node.js

## Alternatives Considered

### npm

- **Pros:** default with Node.js, universal familiarity
- **Cons:** flat `node_modules` allows phantom dependencies, slower installs, weaker workspace support
- **Why not:** phantom dependencies cause production failures that are difficult to diagnose

### yarn (v3+)

- **Pros:** Plug'n'Play for zero-install, good workspace support
- **Cons:** PnP mode has compatibility issues with many packages, complex configuration
- **Why not:** pnpm achieves similar benefits with better compatibility

## References

- ADR-012: Monorepo Strategy
- Configuration: `.npmrc`, `pnpm-workspace.yaml`
