# Developer Experience Recipes

spoonfeed provides 7 developer experience recipes covering local development, configuration validation, data tooling, SDK generation, and admin panels. These recipes reduce friction during development by automating environment setup, data generation, and client SDK creation.

!!! tip "Recommended for all projects"
    - `config-validation` — catches missing environment variables at startup
    - `docker-compose-dev` — one-command local development environment
    - `database-seeding` + `database-factories` — realistic test and dev data

---

## Dev Container

VS Code Dev Container configuration for a fully configured development environment.

| | |
| --- | --- |
| **ID** | `devcontainer` |
| **Compatible with** | All project types |

**Usage:** Open the project in VS Code and select "Reopen in Container" for a ready-to-go environment. Docker Compose services (database, Redis, etc.) start automatically with the container. Port forwarding, extensions, and environment are pre-configured.

**Pairs well with:** `docker-compose-dev`

---

## Docker Compose Dev

One-command local dev environment with hot reload.

| | |
| --- | --- |
| **ID** | `docker-compose-dev` |
| **Compatible with** | HTTP API, Microservice, Scheduled Worker, Full-Stack, Monorepo |

**Usage:**

```bash
docker compose -f docker-compose.dev.yml up
```

Services included:

| Service | Port | Description |
| --- | --- | --- |
| App | 3000 | NestJS with hot reload |
| Debug | 9229 | Node.js inspector |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| Adminer | 8080 | Database management UI |

---

## Config Schema Validation

Validate environment variables at startup with typed Zod schemas.

| | |
| --- | --- |
| **ID** | `config-validation` |
| **Dependencies** | `zod` |
| **Compatible with** | All project types |

**Usage:** Environment variables are validated at startup using Zod schemas in `src/config/env.validation.ts`. Add new env vars to the schema. The app fails fast with descriptive errors if validation fails. Use the `EnvConfig` type for typed config access.

!!! tip
    This recipe catches misconfigured environments at startup instead of at runtime, preventing partial failures in production.

---

## Database Seeding

Database seed command for populating development data.

| | |
| --- | --- |
| **ID** | `database-seeding` |
| **Compatible with** | All project types |

**Usage:** Run `pnpm seed` to populate the database. Seed files live in `src/database/seeds/`. Each seed class implements the `Seeder` interface. Seeds are idempotent and safe to run multiple times.

---

## Database Factories

Test data factories for database entities.

| | |
| --- | --- |
| **ID** | `database-factories` |
| **Compatible with** | All project types |

**Usage:** Use factories to create test data in unit and integration tests:

```typescript
const user = UserFactory.create({ name: 'Test User' });
```

Factories live in `src/database/factories/`. Each entity has a corresponding factory with realistic default values. Override any field in the `create()` call.

---

## SDK Generation

Auto-generate client SDKs from the OpenAPI spec.

| | |
| --- | --- |
| **ID** | `sdk-generation` |
| **Dev dependencies** | `@openapitools/openapi-generator-cli` |
| **Compatible with** | All project types |

**Usage:** Run `pnpm generate:sdk` to generate a TypeScript client SDK from the OpenAPI specification. Output goes to `generated/sdk/`. Commit the generated SDK or publish it as a separate npm package.

!!! note
    Do not manually edit files in `generated/sdk/`. Regenerate after changing API endpoints.

---

## AdminJS

Auto-generated CRUD admin panel with authentication.

| | |
| --- | --- |
| **ID** | `adminjs` |
| **Dependencies** | `adminjs` `@adminjs/nestjs` `@adminjs/express` `express` `express-session` `express-formidable` |
| **Dev dependencies** | `@types/express-session` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_EMAIL` | `admin@example.com` | AdminJS login email |
| `ADMIN_PASSWORD` | `changeme` | AdminJS login password |

**Usage:** Admin panel is available at `/admin`. Register entity resources in `admin.module.ts` to expose CRUD operations. Authentication uses the `ADMIN_EMAIL`/`ADMIN_PASSWORD` environment variables.

!!! warning
    Change the default admin credentials before deploying to any non-local environment.
