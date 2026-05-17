# OpenTelemetry

Distributed tracing and metrics collection using the OpenTelemetry SDK.

## Links

- [OpenTelemetry JS Documentation](https://opentelemetry.io/docs/languages/js/)
- [@opentelemetry/sdk-node on npm](https://www.npmjs.com/package/@opentelemetry/sdk-node)
- [@opentelemetry/api on npm](https://www.npmjs.com/package/@opentelemetry/api)
- [OpenTelemetry JS on GitHub](https://github.com/open-telemetry/opentelemetry-js)

## Dependencies

| Package                                   | Version  | Purpose                          |
| ----------------------------------------- | -------- | -------------------------------- |
| `@opentelemetry/sdk-node`                 | `0.57.2` | OpenTelemetry Node.js SDK        |
| `@opentelemetry/api`                      | `1.9.0`  | OpenTelemetry API                |
| `@opentelemetry/exporter-trace-otlp-http` | `0.57.2` | OTLP HTTP trace exporter         |
| `@opentelemetry/instrumentation-http`     | `0.57.2` | Auto-instrumentation for HTTP    |
| `@opentelemetry/instrumentation-fastify`  | `0.44.2` | Auto-instrumentation for Fastify |
| `@opentelemetry/resources`                | `1.30.1` | Resource attributes              |
| `@opentelemetry/semantic-conventions`     | `1.30.0` | Semantic convention constants    |

## Environment Variables

| Variable                      | Description             | Example                 |
| ----------------------------- | ----------------------- | ----------------------- |
| `OTEL_SERVICE_NAME`           | Service name for traces | `my-api`                |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint | `http://localhost:4318` |

## Usage

Import the tracing setup **before** any other application code in `main.ts`:

```typescript
import '@/infrastructure/telemetry/tracing';
import { NestFactory } from '@nestjs/core';
```

## Generated Files

| File                                      | Description                            |
| ----------------------------------------- | -------------------------------------- |
| `src/infrastructure/telemetry/tracing.ts` | OTel SDK setup with NodeTracerProvider |
