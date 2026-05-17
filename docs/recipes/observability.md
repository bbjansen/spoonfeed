# Observability Recipes

End-to-end observability for NestJS. Instrument your application with OpenTelemetry for traces, metrics, and logs correlation.

## Available Recipes

| Recipe              | Purpose                                     | Recipe README                                                                         |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| OpenTelemetry       | Auto-instrumentation for traces and metrics | [opentelemetry](../../packages/templates/recipes/opentelemetry/README.md)             |
| Request Logging     | Structured HTTP request/response logging    | [request-logging](../../packages/templates/recipes/request-logging/README.md)         |
| Distributed Tracing | Cross-service trace propagation             | [distributed-tracing](../../packages/templates/recipes/distributed-tracing/README.md) |

## The Three Pillars

| Pillar      | Tool                           | Purpose                                  |
| ----------- | ------------------------------ | ---------------------------------------- |
| **Traces**  | OpenTelemetry + Jaeger/Zipkin  | Follow a request across services         |
| **Metrics** | OpenTelemetry + Prometheus     | Measure latency, throughput, error rates |
| **Logs**    | Pino/Winston + correlation IDs | Contextual application events            |

## OpenTelemetry Setup

```typescript
// tracing.ts (load before anything else)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'my-api',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

```typescript
// main.ts
import './tracing'; // must be first import
import { NestFactory } from '@nestjs/core';
```

## Request Logging

```typescript
// request-logging.interceptor.ts
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(`${req.method} ${req.url} ${ms}ms`);
      }),
    );
  }
}
```

## Distributed Tracing

OpenTelemetry automatically propagates trace context via W3C `traceparent` headers. No manual configuration needed when using auto-instrumentation with supported HTTP clients and frameworks.

### Viewing Traces

| Backend       | Type                 | URL                    |
| ------------- | -------------------- | ---------------------- |
| Jaeger        | Self-hosted          | http://localhost:16686 |
| Zipkin        | Self-hosted          | http://localhost:9411  |
| Grafana Tempo | Self-hosted or cloud | Grafana data source    |
| Datadog       | SaaS                 | APM > Traces           |
| AWS X-Ray     | SaaS                 | CloudWatch > X-Ray     |

## External Documentation

- [OpenTelemetry](https://opentelemetry.io)
- [OpenTelemetry Node.js SDK](https://opentelemetry.io/docs/languages/js/)
- [@opentelemetry/sdk-node](https://www.npmjs.com/package/@opentelemetry/sdk-node)
- [@opentelemetry/auto-instrumentations-node](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node)
