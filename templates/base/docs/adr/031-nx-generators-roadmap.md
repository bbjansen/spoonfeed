# ADR-031: Nx Generators for Post-Scaffolding Recipe Management

## Status

Proposed

## Date

2026-05-12

## Context

The current `spoonfeeder` CLI generates projects with selected recipes at creation time. However, teams frequently need to add recipes after project creation (e.g., adding Swagger to an existing API, adding Redis caching mid-project). Currently this requires manual integration.

Nx Generators can modify existing TypeScript files safely using AST transforms, making it possible to:

- Add a recipe to an existing project (`nx g spoonfeeder:add-recipe swagger`)
- Remove a recipe (`nx g spoonfeeder:remove-recipe pino`)
- Migrate between recipes (`nx g spoonfeeder:migrate-orm typeorm-postgres drizzle-postgres`)

## Decision

Explore Nx Generators as a second phase for recipe management. The current generate-and-own approach remains for project creation. Nx Generators would complement it for in-project modifications.

## Consequences

### Positive

- Teams can add recipes incrementally as needs evolve
- AST transforms safely modify imports, module registrations, and providers
- Nx's virtual filesystem stages changes atomically (all-or-nothing)
- Generators can run in dry-run mode for previewing changes
- Pairs naturally with our existing Nx support for monorepo/full-stack types

### Negative

- Significant development effort (AST manipulation is complex)
- Requires Nx as a project dependency (even for standalone apps)
- Must handle all ORM/framework variations in transform logic
- Testing generators requires snapshot testing of file transforms

### Implementation Approach

1. **Phase 1:** Recipe generators that add files + update package.json (no AST)
2. **Phase 2:** Smart generators that modify app.module.ts imports and registrations
3. **Phase 3:** Migration generators between recipes (e.g., TypeORM → Drizzle)

### Technology

- `@nx/devkit` — Generator API with Tree (virtual filesystem), `generateFiles`, `updateJson`
- `ts-morph` — TypeScript AST manipulation for modifying source files
- `@nx/nest` — Reference implementation for NestJS-specific generators

## Alternatives Considered

### Plop.js

- **Pros:** Simple, Handlebars templates, low learning curve
- **Cons:** Cannot modify existing files, only generates new ones
- **Why not:** Doesn't solve the core problem (modifying app.module.ts, package.json)

### Custom AST scripts

- **Pros:** No framework dependency
- **Cons:** Reimplements what Nx already provides (virtual filesystem, atomic commits, dry-run)
- **Why not:** Nx is already in our stack for monorepo/full-stack types

## References

- [Nx Generator Documentation](https://nx.dev/extending-nx/intro/getting-started)
- [@nx/devkit API](https://nx.dev/nx-api/devkit)
- [ts-morph](https://ts-morph.com/)
- [Creating Custom Nx Generators](https://blog.nrwl.io/create-a-custom-nx-workspace-generator-5a915d845fd)
