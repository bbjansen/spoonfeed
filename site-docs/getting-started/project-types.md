# Project Types

spoonfeed supports seven project archetypes. Each type determines the bootstrap code in `main.ts`, the directory structure, default recipes, and which recipes are compatible.

## HTTP REST API

The most common project type. Generates a Fastify-based REST API with validation, Swagger, and structured error handling.

!!! tip "When to use"
    Backend services that expose HTTP endpoints to frontends, mobile apps, or other services. This is the default choice for most web applications and the type with the broadest recipe compatibility.

**Bootstrap:**

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyEtag from '@fastify/etag';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  await app.register(fastifyEtag);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  const url = await app.getUrl();
  new Logger('Bootstrap').log(`Application is running on ${url}`);
}

void bootstrap();
```

**Compatible recipes:** All 112 recipes.

??? example "Generated directory tree"

    ```
    my-api/
      src/
        main.ts                     # Fastify bootstrap
        app.module.ts               # Root module with recipe imports
        config/
          app.config.ts
          database.config.ts        # If DB recipe selected
        shared/
          constants/
          decorators/
          errors/
            application.error.ts
            not-found.error.ts
            validation.error.ts
          filters/
            global-exception.filter.ts
          guards/
          interceptors/
            response.interceptor.ts
          pipes/
            parse-uuid.pipe.ts
          utils/
        infrastructure/
          database/                 # If DB recipe selected
          auth/                     # If auth recipe selected
        app/
          modules/
      tests/
        unit/
        integration/
        e2e/
        factories/
      .env.example
      .env.development
      .env.staging
      .env.production
      docker-compose.yml
      Dockerfile
      package.json
      tsconfig.json
      jest.config.ts
      CLAUDE.md
      .cursor/rules/project.mdc
      .github/
        copilot-instructions.md
        workflows/
          ci.yml
          deploy.yml
    ```

---

## AWS Lambda

Serverless handler configured for AWS Lambda deployments. Wraps the NestJS application for Lambda's event-driven model.

!!! tip "When to use"
    Serverless APIs behind API Gateway, event processors triggered by SQS/SNS/EventBridge, or scheduled Lambda functions. Choose this when you want automatic scaling to zero and pay-per-invocation pricing.

**Bootstrap:**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Context } from 'aws-lambda';
import awsLambdaFastify from '@fastify/aws-lambda';
import { AppModule } from './app.module';

let cachedProxy: (event: unknown, context: Context) => Promise<unknown>;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const fastifyInstance = app.getHttpAdapter().getInstance();
  return awsLambdaFastify(fastifyInstance);
}

export const handler = async (event: unknown, context: Context) => {
  if (!cachedProxy) {
    cachedProxy = await bootstrap();
  }
  return cachedProxy(event, context);
};
```

**Compatible recipes:** Most recipes. Excludes WebSockets, Dev Container, and Docker Compose Dev.

---

## Microservice

Event-driven service with a configurable transport layer. Supports TCP, NATS, RabbitMQ, Kafka, gRPC, and Redis.

!!! tip "When to use"
    Internal services that communicate via message patterns rather than HTTP. Choose this for event-driven architectures, CQRS command handlers, saga orchestrators, or any service-to-service communication that does not need an HTTP interface.

**Bootstrap:**

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    // Transport configuration is injected by the selected transport recipe
  });

  app.enableShutdownHooks();

  await app.listen();
}

void bootstrap();
```

**Compatible recipes:** Queue recipes, database recipes, observability, auth, and most operational recipes. Excludes Swagger, CORS, CSRF, and other HTTP-specific patterns.

??? example "Generated directory tree"

    ```
    my-worker/
      src/
        main.ts                     # Microservice bootstrap (configurable transport)
        app.module.ts
        config/
          app.config.ts
          transport.config.ts       # Transport layer configuration
        shared/
          constants/
          errors/
            application.error.ts
            not-found.error.ts
            validation.error.ts
          filters/
          interceptors/
          pipes/
          utils/
        infrastructure/
          messaging/                # Transport-specific handlers
        app/
          modules/
          handlers/                 # Message pattern handlers
      tests/
        unit/
        integration/
        e2e/
        factories/
      .env.example
      .env.development
      .env.staging
      .env.production
      docker-compose.yml            # Transport infrastructure (RabbitMQ, Redis, etc.)
      Dockerfile
      package.json
      tsconfig.json
      jest.config.ts
      CLAUDE.md
      .cursor/rules/project.mdc
      .github/
        copilot-instructions.md
        workflows/
          ci.yml
          deploy.yml
    ```

---

## CLI Application

Command-line tool built on `nest-commander`. Generates a CLI application with command parsing, options, and help text.

!!! tip "When to use"
    Developer tools, data migration scripts, batch processing utilities, admin tools, or any command-line interface. The generated project includes command and option parsing, help text generation, and testable command handlers.

**Bootstrap:**

```typescript
import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';

async function bootstrap() {
  await CommandFactory.run(AppModule, ['warn', 'error']);
}

void bootstrap();
```

**Compatible recipes:** Database recipes, logging, config validation, and operational recipes. Excludes HTTP-specific recipes (Swagger, CORS, rate limiting, etc.).

---

## Scheduled Worker

Cron-based background jobs with BullMQ task scheduling. Runs recurring tasks on configurable schedules.

!!! tip "When to use"
    Background job processors, scheduled data syncs, report generators, cleanup tasks, or any recurring work that runs on a timer. The generated project includes cron schedule configuration and BullMQ job processing with retries.

**Bootstrap:**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  await app.init();
}

void bootstrap();
```

**Compatible recipes:** Database, queue, logging, observability, cloud, and operational recipes. Excludes HTTP-specific recipes.

---

## Monorepo

Nx workspace with shared libraries and code generators. Sets up a multi-project workspace with shared code between applications.

!!! tip "When to use"
    When you need multiple NestJS applications sharing code (DTOs, interfaces, utilities), or when you want a single repository for related services. Ideal for teams building a platform with multiple backend services that evolve together.

**Structure:**

```
apps/
  api/                  # HTTP API application
  worker/               # Background worker application
libs/
  shared/               # Shared DTOs, interfaces, utilities
  database/             # Shared database entities and migrations
nx.json
```

**Compatible recipes:** All 112 recipes (applied per-application within the workspace).

---

## Full-Stack

NestJS backend paired with a frontend framework. Supports Next.js, Vite (React), Nuxt, and SvelteKit.

!!! tip "When to use"
    When you want a single repository containing both the API and the frontend, with shared types and a unified development experience. Reduces the overhead of managing separate repositories and ensures type safety across the stack.

**Structure:**

```
apps/
  api/                  # NestJS backend
  web/                  # Frontend (Next.js, Vite, Nuxt, or SvelteKit)
libs/
  shared/               # Shared types and DTOs
```

**Compatible recipes:** All 112 recipes (applied to the backend application).

---

## Comparing Project Types

=== "HTTP-based"

    | Type | Transport | Scaling | Best For |
    | --- | --- | --- | --- |
    | **HTTP REST API** | Fastify HTTP | Horizontal (containers) | Standard web APIs, public-facing services |
    | **AWS Lambda** | API Gateway + Lambda | Automatic (serverless) | Event-driven APIs, pay-per-use workloads |
    | **Full-Stack** | Fastify HTTP + Frontend | Horizontal (containers) | Unified frontend + backend repositories |

=== "Event-driven"

    | Type | Transport | Scaling | Best For |
    | --- | --- | --- | --- |
    | **Microservice** | TCP, NATS, RabbitMQ, Kafka, gRPC, Redis | Horizontal (containers) | Internal services, message-based communication |
    | **Scheduled Worker** | Cron + BullMQ | Vertical / Horizontal | Background jobs, recurring tasks, data pipelines |

=== "Specialized"

    | Type | Transport | Scaling | Best For |
    | --- | --- | --- | --- |
    | **CLI Application** | stdin/stdout | N/A | Developer tools, migration scripts, admin utilities |
    | **Monorepo** | Mixed (per-app) | Per-application | Multi-service platforms, shared code across services |
