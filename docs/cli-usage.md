# CLI Usage -- spoonfeeder Scaffolder

## Quick Start

```bash
git clone <repo-url>
cd spoonfeeder
pnpm install
pnpm create-spoonfeeder
```

The CLI launches an interactive wizard that walks you through project setup.

## Interactive Flow

1. **Project name** -- kebab-case identifier (e.g. `order-service`)
2. **Project type** -- select from the table below
3. **Recipes** -- toggle add-ons relevant to the chosen type
4. **Package manager** -- pnpm (default), npm, or yarn
5. **Git init** -- initialize a git repository (default: yes)
6. **Install dependencies** -- run install automatically (default: yes)

## Project Types

| Type               | Description                                   | Default Port |
| ------------------ | --------------------------------------------- | ------------ |
| `http-api`         | REST/GraphQL API with Fastify                 | 3000         |
| `aws-lambda`       | Serverless functions for AWS Lambda           | --           |
| `microservice`     | NestJS microservice with transport layer      | --           |
| `cli-app`          | Command-line application using nest-commander | --           |
| `scheduled-worker` | Background jobs and cron tasks                | --           |
| `monorepo`         | Nx-powered multi-app workspace                | --           |
| `full-stack`       | Backend + frontend in one repository          | 3000 / 5173  |

## Smart Defaults per Project Type

Each project type pre-selects recipes that make sense for its use case:

| Type               | Pre-selected Recipes                                   |
| ------------------ | ------------------------------------------------------ |
| `http-api`         | Fastify, class-validator, helmet, CORS, health check   |
| `aws-lambda`       | Serverless Framework, AWS SDK, dotenv                  |
| `microservice`     | Transport layer, health check, graceful shutdown       |
| `cli-app`          | nest-commander, inquirer                               |
| `scheduled-worker` | @nestjs/schedule, BullMQ, health check                 |
| `monorepo`         | Nx, shared-libs scaffold, workspace lint               |
| `full-stack`       | Proxy config, shared types lib, concurrent dev scripts |

## Recipe Add-ons

### Database

| Recipe   | What It Adds                      |
| -------- | --------------------------------- |
| Postgres | TypeORM + pg driver, migrations   |
| MongoDB  | Mongoose ODM, connection module   |
| Redis    | ioredis, cache module             |
| Prisma   | Prisma client, schema, migrations |

### API

| Recipe     | What It Adds                         |
| ---------- | ------------------------------------ |
| Swagger    | @nestjs/swagger, auto-generated docs |
| GraphQL    | @nestjs/graphql, Apollo driver       |
| Versioning | URI-based API versioning scaffold    |

### Auth

| Recipe  | What It Adds                       |
| ------- | ---------------------------------- |
| JWT     | @nestjs/jwt, passport-jwt strategy |
| OAuth2  | Passport OAuth2 strategies         |
| API Key | Custom guard, key validation       |

### Messaging

| Recipe   | What It Adds                        |
| -------- | ----------------------------------- |
| RabbitMQ | @nestjs/microservices, amqplib      |
| Kafka    | kafkajs, consumer/producer modules  |
| SQS      | @aws-sdk/client-sqs, polling module |

### Observability

| Recipe        | What It Adds                     |
| ------------- | -------------------------------- |
| Pino          | nestjs-pino, structured logging  |
| OpenTelemetry | @opentelemetry/sdk-node, tracing |
| Prometheus    | prom-client, /metrics endpoint   |

### Infrastructure

| Recipe         | What It Adds                   |
| -------------- | ------------------------------ |
| Docker         | Dockerfile, docker-compose.yml |
| Terraform      | IaC module scaffold            |
| GitHub Actions | CI/CD workflow files           |

## Conflict Rules

Some recipes are mutually exclusive. The CLI prevents selecting conflicting combinations:

| Conflict Group | Options (pick one)          |
| -------------- | --------------------------- |
| ORM            | TypeORM **or** Prisma       |
| API style      | REST/Swagger **or** GraphQL |
| Logger         | Pino **or** default logger  |
| Database       | Postgres **or** MongoDB     |

Selecting a conflicting recipe automatically deselects the previous choice with a warning.

## Example: HTTP API with Swagger + Postgres

```text
$ pnpm create-spoonfeeder

? Project name: order-service
? Project type: http-api
? Select recipes:
  [x] Swagger
  [x] Postgres (TypeORM)
  [x] JWT Auth
  [x] Docker
  [x] Pino Logger
? Package manager: pnpm
? Initialize git? Yes
? Install dependencies? Yes

Scaffolding order-service...
  - http-api base
  - Swagger docs at /api/docs
  - Postgres with TypeORM
  - JWT authentication
  - Docker multi-stage build
  - Pino structured logging

Done. cd order-service && pnpm start:dev
```

The generated project includes a working health-check endpoint, Swagger UI, database connection, and JWT guard out of the box.
