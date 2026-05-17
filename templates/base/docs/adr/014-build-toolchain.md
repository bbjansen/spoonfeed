# ADR-014: SWC as Default Build Toolchain

## Status

Accepted

## Date

2026-04-01

## Context

TypeScript projects require a compilation step from TS to JS. The default `tsc` compiler is correct but slow, especially in large monorepos. NestJS v10+ ships with first-class SWC support via `@swc/core` and the `nest build --builder swc` flag.

## Decision

Use SWC (`@swc/core`) as the default TypeScript compiler for both builds and tests. The toolchain consists of:

- **Build:** `nest build --builder swc` via `@nestjs/cli` with SWC builder
- **Tests:** `@swc/jest` as the Jest transform, configured in `jest.config.ts`
- **Path aliases:** `tsc-alias` as a post-build step to resolve `@/*` path mappings in emitted JS
- **Type checking:** `tsc --noEmit` run separately in CI (SWC does not type-check)

## Consequences

### Positive

- 10-20x faster compilation than `tsc` for incremental builds
- Jest test suites start significantly faster with `@swc/jest` (no `ts-jest` overhead)
- SWC supports TypeScript 5 decorators and `emitDecoratorMetadata` via `@swc/core` plugins
- NestJS CLI has native SWC integration — no custom webpack config needed
- Hot Module Replacement (HMR) in `start:dev` is near-instant

### Negative

- SWC does not perform type checking — requires a separate `tsc --noEmit` step in CI
- Some edge-case TypeScript features (const enums across files, composite projects) need workarounds
- `tsc-alias` adds a post-build step for path alias resolution

### Risks

- Decorator metadata divergence between SWC and tsc — mitigated by testing DI resolution in integration tests

## Alternatives Considered

### tsc (TypeScript Compiler)

- **Pros:** Official compiler, type checking included, zero config
- **Cons:** 10-20x slower builds, slower test startup
- **Why not:** Build speed directly impacts developer experience and CI costs

### esbuild

- **Pros:** Extremely fast, Go-based
- **Cons:** No decorator metadata support, no NestJS CLI integration
- **Why not:** NestJS depends on `emitDecoratorMetadata` for DI; esbuild cannot emit it

## References

- [NestJS SWC Builder](https://docs.nestjs.com/recipes/swc)
- Packages: `@swc/core`, `@swc/jest`, `tsc-alias`
