# ADR-019: Seven Project Types with Template Overlays

## Status

Accepted

## Date

2026-04-01

## Context

Not all backend applications are HTTP APIs. Teams build Lambda functions, CLI tools, background workers, and microservices. A single project template cannot serve all these use cases without shipping unnecessary boilerplate for each.

## Decision

Support seven project types, each with a distinct `main.ts` bootstrap, package fragment, and template overlay applied on top of the shared base template:

| Project Type     | Bootstrap                                      | Transport                     | Key Packages                                  |
| ---------------- | ---------------------------------------------- | ----------------------------- | --------------------------------------------- |
| **HTTP API**     | `NestFactory.create(FastifyAdapter)`           | HTTP                          | `@nestjs/platform-fastify`                    |
| **Lambda**       | `@codegenie/serverless-express` handler export | HTTP via API Gateway          | `@codegenie/serverless-express`, `aws-lambda` |
| **Microservice** | `NestFactory.createMicroservice()`             | TCP / RabbitMQ / Kafka / gRPC | `@nestjs/microservices`                       |
| **CLI**          | `nest-commander` bootstrap                     | stdin/stdout                  | `nest-commander`                              |
| **Worker**       | `NestFactory.createApplicationContext()`       | Queue consumer                | `@nestjs/bullmq`, `bullmq`                    |
| **Monorepo**     | Multiple apps with shared libs                 | Per-app                       | `@nestjs/cli` workspaces                      |
| **Full-Stack**   | NestJS API + frontend framework                | HTTP + SSR/SPA                | Per-framework (see ADR-020)                   |

The CLI presents project type selection as the first prompt. Each type determines:

1. Which `main.ts` template to use
2. Which package fragments to merge into `package.json`
3. Which recipes are available (e.g., `aws-lambda-deploy` only for Lambda type)
4. Which default recipes to pre-select

Microservice transport is a sub-selection within the Microservice type, choosing between TCP, RabbitMQ (`@nestjs/microservices` + `amqplib`), Kafka (`kafkajs`), and gRPC (`@grpc/grpc-js`).

## Consequences

### Positive

- Each project type ships only the dependencies and configuration it needs
- New project types can be added without modifying the base template
- Transport selection for microservices is explicit, not a hidden config option
- Template overlays are composable with recipes for maximum flexibility

### Negative

- Seven project types increase scaffolder complexity and test surface
- Some recipes are only valid for certain project types — requires type-aware recipe filtering
- Monorepo type has significantly different directory structure than single-app types

### Risks

- Project type proliferation — mitigated by requiring an ADR for each new type

## References

- ADR-007: Scaffolder Architecture
- ADR-008: Composable Recipe System
- ADR-012: Monorepo Strategy
