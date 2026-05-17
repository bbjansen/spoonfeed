# ADR-001: NestJS with Fastify Adapter

## Status

Accepted

## Date

2026-01-01

## Context

We needed a Node.js framework for building production APIs that provides:

- TypeScript-first development
- Modular architecture with dependency injection
- High performance for microservices
- Strong ecosystem for common patterns (auth, validation, documentation)

## Decision

Use NestJS with the Fastify HTTP adapter instead of Express.

## Consequences

### Positive

- TypeScript decorators and DI provide clean, testable architecture
- Fastify is 2-3x faster than Express for HTTP parsing
- NestJS has first-class support for microservices, WebSockets, GraphQL
- Large ecosystem of official and community modules

### Negative

- Fastify middleware differs from Express middleware (some npm packages need adaptation)
- Learning curve for developers unfamiliar with Angular-style patterns

### Risks

- Fastify plugin compatibility: mitigated by testing critical plugins

## Alternatives Considered

### Express (standalone)

- **Pros:** Most popular, largest ecosystem
- **Cons:** No built-in DI, no TypeScript decorators, slower
- **Why not:** Lacks architectural opinions needed for team consistency

### Fastify (standalone)

- **Pros:** Fast, good plugin system
- **Cons:** No DI, no decorators, manual architecture needed
- **Why not:** NestJS provides the architectural layer Fastify lacks
