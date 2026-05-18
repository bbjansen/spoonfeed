# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-05-17

Initial public release.

### Added

#### Project Scaffolding
- Interactive CLI with @clack/prompts for guided project creation
- 7 project types: HTTP REST API (Fastify), AWS Lambda, Microservice (8 transports), CLI Application, Scheduled Worker, Monorepo (Nx), Full-Stack
- 112 composable recipes across 24 categories
- Recipe conflict detection and dependency validation
- Smart defaults per cloud provider and project type
- Best practice recipes auto-selected (helmet, cors, health-checks, graceful-shutdown, correlation-id, request-logging)

#### Recipe Categories
- Database: TypeORM (Postgres, MySQL), Prisma, Drizzle, MikroORM, Mongoose, Kysely, Redis
- Authentication: JWT, Passport, API keys, RBAC/CASL, OAuth providers, MFA/TOTP, DPoP
- Cloud: 12 AWS recipes, 10 GCP recipes, 10 Azure recipes
- Security: Helmet, CORS, CSRF, rate limiting, data masking, content digest
- API Patterns: Pagination, filtering, versioning, i18n, idempotency, JSON Patch, SSE
- Observability: OpenTelemetry, distributed tracing, Prometheus, request logging
- Queues: RabbitMQ, BullMQ, dead letter queues
- And more: WebSockets, GraphQL (Mercurius), CQRS, file upload, webhooks, audit trail

#### Generated Project Features
- RFC 9457 Problem Details error responses with typed error hierarchy and trace codes
- AI assistant context generation (Claude Code, Cursor, GitHub Copilot) tailored to selected recipes
- Test scaffolds: unit, integration (Testcontainers), E2E, shared factories
- Exact dependency versions (no ^/~ ranges)
- Husky + commitlint + lint-staged for conventional commits
- Per-environment .env files (development, staging, production)
- Docker Compose for dev services
- CI/CD templates (GitHub Actions, Azure DevOps)
- ESLint + Prettier preconfigured

#### Nx Generators
- `spoonfeed:add` — add a recipe to an existing project
- `spoonfeed:remove` — cleanly remove a recipe (deps, config, source, tests, AI context)
- `spoonfeed:migrate` — migrate between compatible recipes (e.g., TypeORM to Prisma)
- `spoonfeed:list` — list available and installed recipes with conflict annotations

#### Standards Compliance
- RFC 9457 (Problem Details for HTTP APIs)
- RFC 6902 (JSON Patch)
- RFC 7240 (Prefer Header)
- RFC 9530 (Content Digest)
- RFC 9449 (DPoP)
- RFC 9111 (HTTP Caching)
- RFC 9562 (UUID v6/v7)
- W3C Trace Context
- OWASP security headers
