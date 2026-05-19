# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.3](https://github.com/bbjansen/spoonfeed/compare/spoonfeed-v0.2.2...spoonfeed-v0.2.3) (2026-05-19)


### Bug Fixes

* add missing amqp-connection-manager peer dep to rabbitmq recipe ([5111877](https://github.com/bbjansen/spoonfeed/commit/51118771bb7870f8b97c080f84de77c5aea65909))
* remove empty infrastructure scaffolding dirs from base template ([dbb5d0a](https://github.com/bbjansen/spoonfeed/commit/dbb5d0a95006bdfcad60451f1c3adfa9a1029a03))

## [0.2.2](https://github.com/bbjansen/spoonfeed/compare/spoonfeed-v0.2.1...spoonfeed-v0.2.2) (2026-05-19)


### Features

* initial release of spoonfeeder nestjs scaffolder ([aacfb8e](https://github.com/bbjansen/spoonfeed/commit/aacfb8e2e8234b94aee2df5fc53923b093569e6d))
* prepare v0.1.0 for public release ([ef87cee](https://github.com/bbjansen/spoonfeed/commit/ef87cee78606dc712c1c43b76054fe8f5f57bec2))
* rename to spoonfeed, fix monorepo/full-stack start ([b018389](https://github.com/bbjansen/spoonfeed/commit/b018389d34350181b4d744b69b456f5c9de21a3e))
* wire 46 recipe modules into app.module.ts via moduleImport ([c623539](https://github.com/bbjansen/spoonfeed/commit/c62353964ae24d3de027173b1919d598558f8e51))


### Bug Fixes

* correct non-existent npm versions for grpc and mqtt transport deps ([03460f6](https://github.com/bbjansen/spoonfeed/commit/03460f6657f1f0da15509ab3dcf66c30d3503672))
* cover "never touched" areas — terraform, migrate, list, post-generate, cross-cloud ([2604fcb](https://github.com/bbjansen/spoonfeed/commit/2604fcbc83363f62244ed800d81f4cf33f6b356e))
* create 8 service module wrappers, restrict 2 middleware recipes, replace deprecated package ([175910a](https://github.com/bbjansen/spoonfeed/commit/175910a1fea29d02ad3d5df608dd86badcec2470))
* generate project in current directory instead of parent ([#1](https://github.com/bbjansen/spoonfeed/issues/1)) ([7a3acb6](https://github.com/bbjansen/spoonfeed/commit/7a3acb69f6f530692200b926d52d7870f54b152b))
* rebuild dist/ before publish — stale compiled JS caused httpAdapter undefined in templates ([15e77bb](https://github.com/bbjansen/spoonfeed/commit/15e77bb424e0a5272bbfa4ecb076ae154fa7863f))
* resolve 39 cross-stack generator bugs, add 2021 integration tests ([8066555](https://github.com/bbjansen/spoonfeed/commit/8066555067454ec0448ff118a68bf2a53b60caea))
* resolve 4 template bugs found by deep matrix (every recipe x both adapters) ([126749c](https://github.com/bbjansen/spoonfeed/commit/126749cd3c157c4b9a7f95980c3354d65951082f))
* resolve 6 generated test template bugs ([09660a0](https://github.com/bbjansen/spoonfeed/commit/09660a02773c8e40222c23377841cea55d6cb0f7))
* resolve 6 recipe type errors (sendgrid, docs-site, gcp-logging, azure-entra-id, serialization-groups, file-upload) ([bee4677](https://github.com/bbjansen/spoonfeed/commit/bee46770668a4efb319d2d47736923c2a5b0b2f0))
* resolve 8 add/remove-recipe lifecycle bugs ([2e8f575](https://github.com/bbjansen/spoonfeed/commit/2e8f5759b9158a2777bb441f1ec211d5d2f20210))
* update 6 test expectations for terraform multi-cloud, env dedup, and moduleImport changes ([447cbf7](https://github.com/bbjansen/spoonfeed/commit/447cbf744439bee05ec8bea519551268e2f95285))

## [0.2.0] — 2026-05-19

### Added

#### Express Adapter Support
- Full Express adapter support across all HTTP project types (http-api, aws-lambda, full-stack, monorepo)
- Every recipe template is now adapter-aware with EJS conditionals for Express vs Fastify code paths
- Config validator rejects graphql-mercurius with Express adapter (Fastify-only)

#### Transport Layer Generation
- Microservice projects now generate transport-specific main.ts configuration for all 8 transports (TCP, Redis, NATS, MQTT, RabbitMQ, Kafka, gRPC, custom)
- Transport-specific npm dependencies automatically added (ioredis, kafkajs, nats, mqtt, amqplib, @grpc/grpc-js)
- Transport-specific environment variables in .env.example

#### Module Registration
- All 54 recipes with NestJS modules are now automatically imported into app.module.ts
- Created module wrappers for 8 service-only recipes (prisma, sendgrid, dead-letter-queue, feature-flags, graceful-shutdown, mfa-totp, transactional-outbox, webhooks)
- add-recipe generator now also applies moduleImport during post-generation recipe additions

#### Multi-Cloud Terraform
- Terraform deploy templates now generate cloud-appropriate resources (AWS ECS, GCP Cloud Run, Azure Container Apps)
- Backend configuration adapts to cloud provider (S3, GCS, azurerm)
- Provider blocks and variables are cloud-aware

#### Config Validation
- Recipe conflict validation (rejects conflicting ORM/logger/email combos)
- Recipe requires validation (rejects missing dependency chains)
- Recipe compatibleWith validation (rejects HTTP-only recipes on non-HTTP projects)
- Cross-cloud validation (rejects AWS recipes with GCP/Azure provider and vice versa)
- graphql-mercurius + Express rejection

#### Manifest Completeness
- .spoonfeed.json now records name, scope, httpAdapter, frontendFramework, transportLayer
- add-recipe reads all manifest fields for template rendering

#### Recipe Package Fragments
- Generator now loads recipe-level package-fragment.json files (for scripts like docs:dev)
- add-recipe and remove-recipe handle fragment scripts correctly

### Fixed

#### Generator
- Base package.json.ejs no longer leaks HTTP adapter devDependencies to non-HTTP project types
- HTTP-specific base files (exception filter, timeout middleware, e2e test) removed for non-HTTP projects
- Package.json merger deduplicates cross-section deps (runtime takes precedence over dev)
- Env merger produces deterministic output (sections sorted alphabetically, shared vars as comments)
- CLAUDE.md includes project name/scope, correct import alias for workspace projects, and workspace layout info
- Kubernetes manifests use project name instead of hardcoded "app"
- Dockerfile and docker-compose handle workspace layouts (full-stack/monorepo)

#### Recipe Definitions
- 13 HTTP-only recipes restricted from non-HTTP project types (cors, throttler, pagination, filtering, api-versioning, health-checks, opentelemetry, correlation-id, request-logging, csrf, http-caching, distributed-tracing, multi-tenancy)
- Bidirectional conflict declarations for ORM recipes, s3-minio/aws-s3, rabbitmq/bullmq
- @nestjs/microservices version fixed in rabbitmq recipe (v10 to v11)
- @nestjs/websockets and @nestjs/platform-socket.io fixed in websockets recipe (v10 to v11)
- Non-existent npm versions fixed (@grpc/grpc-js, mqtt)
- Deprecated conventional-changelog-cli replaced with conventional-changelog
- AI context Fastify-specific text neutralized in 4 recipes (helmet, cors, csrf, file-upload)

#### Add/Remove Recipe Lifecycle
- add-recipe respects Express adapter (uses expressDependencies and expressMainTsSetup)
- add-recipe copies template files and records them in manifest
- add-recipe loads recipe package-fragment.json for scripts
- add-recipe deduplicates env vars with shared-with comments
- add-recipe validates graphql-mercurius + Express
- add-recipe passes all 7 template data fields to EJS
- remove-recipe promotes shared env vars when owning recipe is removed
- remove-recipe removes fragment-contributed scripts
- remove-recipe protects import specifiers needed by other recipes
- Multi-line Prettier-formatted imports correctly removed

#### Migrate Recipe
- Fixed incomplete dependent satisfaction check (now simulates full post-migration set)
- Schema supports positional args for from/to

#### List Recipes
- Filters recipes by compatibleWith (incompatible recipes no longer shown as available)
- JSON output includes description, requires, compatibleWith

#### Post-Generate
- pnpm install uses --ignore-scripts (supply chain safety)
- git commit disables GPG signing for initial scaffolding commit

#### Templates
- EJS blank lines fixed with -%> trimming across 7 template files
- http-exception.filter unit test converted to adapter-aware EJS
- prefer-header interceptor uses correct Express API (response.status vs response.code)
- app.module.ts single-element imports formatted for prettier compliance
- docs-site recipe: added index.md, guide page, and package-fragment.json with scripts
- docs-site VitePress config: removed @ prefix from GitHub URLs

### Test Coverage
- 2114 unit and integration tests
- 31 integration test suites covering recipe definitions, cross-adapter diffs, non-HTTP projects, cloud providers, frontend frameworks, deployment/CI-CD, max recipe combos, transport layers, scoped names, template rendering, package.json integrity, config validation, default presets, add/remove/migrate lifecycle, and more
- Deep matrix: every HTTP-compatible recipe tested individually with both Fastify and Express adapters (227 tests)
- 45 heavy combo generate+install+compile tests across all project types, adapters, transports, and cloud providers
- 151 npm package versions verified against registry
- Generated project unit and e2e tests confirmed passing

## [0.1.1](https://github.com/bbjansen/spoonfeed/compare/spoonfeed-v0.1.0...spoonfeed-v0.1.1) (2026-05-17)


### Features

* initial release of spoonfeed nestjs scaffolder ([aacfb8e](https://github.com/bbjansen/spoonfeed/commit/aacfb8e2e8234b94aee2df5fc53923b093569e6d))
* prepare v0.1.0 for public release ([ef87cee](https://github.com/bbjansen/spoonfeed/commit/ef87cee78606dc712c1c43b76054fe8f5f57bec2))


### Bug Fixes

* generate project in current directory instead of parent ([#1](https://github.com/bbjansen/spoonfeed/issues/1)) ([7a3acb6](https://github.com/bbjansen/spoonfeed/commit/7a3acb69f6f530692200b926d52d7870f54b152b))

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
