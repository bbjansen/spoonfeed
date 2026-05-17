# ADR-003: Multiple ORM Support via Recipes

## Status

Accepted

## Date

2026-01-20

## Context

Different projects have different database needs. Some teams prefer schema-first (Prisma), some prefer decorator-based (TypeORM), some need lightweight SQL (Drizzle/Kysely), and some use MongoDB (Mongoose). Forcing one ORM limits adoption.

## Decision

Support multiple ORMs as mutually exclusive recipes: TypeORM (Postgres/MySQL), Prisma, Mongoose, Drizzle ORM, MikroORM, and Kysely. Each recipe provides a NestJS module, schema/entity examples, migration setup, and documentation.

Only one ORM can be selected per project (enforced by conflict detection).

## Consequences

### Positive

- Teams choose the ORM that fits their project and expertise
- Each ORM recipe is self-contained with its own module, config, and migrations
- Conflict detection prevents incompatible combinations

### Negative

- More recipes to maintain
- Shared patterns (seeding, factories) must be adapted per ORM

## Alternatives Considered

### TypeORM only

- **Pros:** Single solution, less maintenance
- **Cons:** Not every project needs a full ORM; excludes Prisma and Drizzle fans
- **Why not:** Limiting choice reduces boilerplate adoption
