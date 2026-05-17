# ADR-029: AdminJS as Admin Panel Recipe

## Status

Accepted

## Date

2026-05-01

## Context

Most backend applications eventually need an admin panel for data inspection, manual corrections, and operational tasks. Building a custom admin UI is expensive and rarely differentiated — the effort is better spent on the core product. The admin panel must integrate with the existing ORM and authentication without requiring a separate frontend deployment.

## Decision

Provide AdminJS as an opt-in recipe for auto-generated admin panels. Key design choices:

- **Auto-generated CRUD:** AdminJS introspects ORM entity metadata to generate list, show, create, edit, and delete views with filtering, sorting, and pagination — no manual form definitions required
- **ORM adapter pattern:** the recipe uses `@adminjs/typeorm` by default; adapters exist for Prisma (`@adminjs/prisma`), Mongoose (`@adminjs/mongoose`), and MikroORM (`@adminjs/mikroorm`), matching the boilerplate's ORM-agnostic philosophy
- **NestJS integration:** `@adminjs/nestjs` mounts AdminJS as a NestJS module at `/admin`, sharing the application's dependency injection container and middleware pipeline
- **Authentication:** environment-based credentials (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) for simplicity in development and staging; production deployments should integrate with the application's auth system (ADR-004)
- **Customization escape hatches:** custom actions, components, and dashboard widgets can be added per-resource without ejecting from the framework

### When to use AdminJS vs custom admin

- **Use AdminJS:** internal data browsing, support team tools, content management, entity CRUD operations
- **Build custom:** customer-facing dashboards, complex multi-step workflows, real-time data visualization, highly branded experiences

## Consequences

### Positive

- Admin panel available in minutes rather than weeks of custom development
- Entity schema changes automatically reflected in the admin UI — no form maintenance
- Single deployment — admin panel runs within the NestJS application process
- ORM adapter swap requires only changing the adapter package, not rewriting admin configuration

### Negative

- AdminJS bundles a React frontend that increases the application's dependency footprint
- Customization beyond standard CRUD requires learning AdminJS's component API
- Performance may degrade with very large datasets without explicit pagination configuration

### Risks

- Security exposure if admin routes are not properly protected — mitigated by authentication guard and network-level access controls (VPN, IP allowlist)

## References

- ADR-003: Database Strategy
- ADR-004: Authentication Architecture
- Packages: `adminjs`, `@adminjs/nestjs`, `@adminjs/typeorm`
