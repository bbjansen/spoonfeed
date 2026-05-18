# spoonfeed

Interactive CLI that scaffolds production-ready NestJS projects with **112 composable recipes**. Pick a project type, choose your stack, and get a working codebase with structured error handling, test scaffolds, and deployment configs — ready to ship.

## Quick Start

```bash
npx spoonfeed
```

Or with pnpm:

```bash
pnpm dlx spoonfeed
```

One command. The CLI walks you through project name, type, cloud provider, and recipe selection, then generates everything to disk.

## Why spoonfeed?

- **Skip hours of boilerplate setup.** A production-ready NestJS project with structured errors, test scaffolds, CI pipelines, Docker configs, and environment files — generated in seconds instead of assembled by hand over days.
- **Every recipe is tested against the generated project.** Recipes are not loose code snippets. Each one is validated to produce a project that compiles, lints, and passes its own test suite.
- **Conflict detection prevents broken configs.** Recipes declare explicit conflicts and requirements. The CLI rejects incompatible combinations before generating a single file, so you never end up with a project that fails on first boot.
- **No lock-in.** The generated project has zero runtime dependency on spoonfeed. It is a standard NestJS application that you own entirely. Eject on day one if you want.

## How does this differ from `nest new`?

`nest new` gives you a minimal starter: a single module, a single controller, and a `package.json`. Everything else — database setup, authentication, validation, Docker, CI/CD, environment configs, error handling, test structure — is left to you.

spoonfeed gives you a **production-ready project** from the start. You select which capabilities you need, and the CLI wires them together with correct imports, configuration, typed errors, test scaffolds, and deployment files. The result is what your project would look like after a week of manual setup, generated in one command.

## What Gets Generated

A typical HTTP REST API project with a handful of recipes produces a structure like this:

```
my-api/
  src/
    main.ts                       # Bootstrap (Fastify, configured for your project type)
    app.module.ts                 # Root module with recipe imports wired in
    config/
      app.config.ts               # Typed configuration factory
      database.config.ts          # Database connection config (if DB recipe selected)
    shared/
      constants/
        error-codes.constant.ts   # Centralized error trace codes
      decorators/
      errors/                     # Typed error hierarchy
        application.error.ts
        not-found.error.ts
        validation.error.ts
      filters/
        http-exception.filter.ts    # RFC 9457 Problem Details responses
      guards/
      interceptors/
        response.interceptor.ts   # Uniform response envelope
      pipes/
        parse-uuid.pipe.ts
      utils/
        retry.util.ts
        sleep.util.ts
    infrastructure/               # External integrations (per selected recipes)
      database/
      auth/
    app/
      modules/                    # Feature modules (your application code goes here)
  tests/
    unit/                         # Unit tests mirroring src/ structure
    integration/                  # Integration tests (Testcontainers)
    e2e/                          # End-to-end HTTP tests
    factories/                    # Shared test data builders
  .env.example                    # Environment variable template
  .env.development                # Dev defaults
  .env.staging                    # Staging defaults
  .env.production                 # Production template (no secrets)
  docker-compose.yml              # Dev containers (Postgres, Redis, etc.)
  Dockerfile                      # Multi-stage production build
  CLAUDE.md                       # AI context for Claude
  .cursor/rules/project.mdc       # AI context for Cursor
  .github/
    copilot-instructions.md       # AI context for Copilot
    workflows/
      ci.yml                      # CI pipeline
      deploy.yml                  # Deployment pipeline
  package.json                    # Exact dependency versions (no ^ or ~)
  tsconfig.json
  tsconfig.build.json
  .eslintrc.js
  .prettierrc
  jest.config.ts
```

## What It Looks Like

```text
┌  spoonfeed — NestJS Project Generator
│
◇  Project name
│  my-api
│
◆  Project type
│  ● HTTP REST API (Fastify)
│  ○ AWS Lambda
│  ○ Microservice
│  ○ CLI Application
│  ○ Scheduled Worker
│  ○ Monorepo (Nx)
│  ○ Full-Stack
│
◇  Cloud provider
│  AWS
│
◆  Select recipes
│  ◼ TypeORM + PostgreSQL
│  ◼ JWT Authentication
│  ◼ Swagger / OpenAPI
│  ◼ Pino Logging
│  ◼ Health Checks
│  ◼ Helmet Security Headers
│  ◻ Rate Limiting
│  ◻ CORS
│  ◻ OpenTelemetry
│  ◻ Prometheus
│  ... 103 more available
│
◇  Confirm
│  Project:    my-api
│  Type:       HTTP REST API
│  Cloud:      AWS
│  Recipes:    6 selected
│  Output:     ./my-api
│
◒  Creating project structure...
│
◇  Project structure created.
│
│  Next steps
│  cd my-api
│  pnpm install
│  pnpm start:dev
│
└  Project created successfully!
```

## Feature Highlights

- **7 project types** — HTTP REST API, AWS Lambda, Microservice, CLI Application, Scheduled Worker, Monorepo, Full-Stack
- **112 composable recipes** — Database, auth, cloud (AWS/GCP/Azure), API patterns, observability, queues, security, and more
- **RFC 9457 error responses** — Typed error hierarchy with trace codes and Problem Details for HTTP APIs
- **AI assistant context** — Auto-generated `CLAUDE.md`, `.cursor/rules/project.mdc`, and `.github/copilot-instructions.md` tailored to your stack
- **Test scaffolds** — Unit, integration (Testcontainers), and E2E test structure with factories
- **Exact dependency versions** — No `^`, no `~`, no supply-chain surprises
- **Nx generators** — Add, remove, or migrate recipes after scaffolding
- **No runtime dependency** — The generated project is a standard NestJS application

## Key Sections

| Section | What You Will Find |
| --- | --- |
| [Quick Start](getting-started/quick-start.md) | Installation, CLI walkthrough, first project |
| [Project Types](getting-started/project-types.md) | Detailed guide for each of the 7 archetypes |
| [Recipe Overview](recipes/index.md) | How recipes work, conflicts, smart defaults |
| [Full Recipe List](recipes/all.md) | Complete catalog of all 112 recipes |
| [Nx Generators](generators/index.md) | Add, remove, and migrate recipes post-scaffolding |
| [Architecture](architecture/index.md) | Layered architecture, directory structure |
| [Standards](architecture/standards.md) | RFC compliance and standards reference |

## Requirements

- Node.js >= 22.0.0
- pnpm >= 9.0.0 (recommended) or npm

## License

MIT — BBJ Systems Holding
