# Logging and Observability

## Log Levels

| Level   | When to Use                                   | Examples                                      |
| ------- | --------------------------------------------- | --------------------------------------------- |
| `fatal` | Application cannot continue                   | Database connection lost, out of memory       |
| `error` | Operation failed, requires attention          | Unhandled exception, payment gateway error    |
| `warn`  | Unexpected condition, but operation continues | Deprecated API usage, retry triggered         |
| `info`  | Significant business event                    | Order created, user registered, job started   |
| `debug` | Diagnostic information for development        | Query executed, cache hit/miss, config loaded |
| `trace` | Highly detailed execution flow                | Method entry/exit, loop iterations            |

### Production Configuration

| Environment | Minimum Level | Format     |
| ----------- | ------------- | ---------- |
| Production  | `info`        | JSON       |
| Staging     | `debug`       | JSON       |
| Development | `debug`       | Pretty     |
| Test        | `warn`        | Suppressed |

## Structured Logging Rules

All logs must be structured (JSON in production). Never use string interpolation for log data.

```typescript
// correct -- structured
this.logger.info({
  event: 'order.created',
  orderId: order.id,
  userId: order.userId,
  total: order.total,
  itemCount: order.items.length,
});

// wrong -- unstructured string
this.logger.info(`Order ${order.id} created by ${order.userId} for $${order.total}`);
```

### Required Fields

Every log entry must include:

| Field           | Source          | Description                |
| --------------- | --------------- | -------------------------- |
| `timestamp`     | Logger          | ISO 8601 timestamp         |
| `level`         | Logger          | Log level                  |
| `message`       | Developer       | Human-readable description |
| `service`       | Config          | Service name               |
| `environment`   | Config          | Runtime environment        |
| `correlationId` | Request context | Request correlation ID     |

### Pino Configuration

```typescript
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        genReqId: (req) => req.headers['x-correlation-id'] ?? randomUUID(),
      },
    }),
  ],
})
export class AppModule {}
```

## Request Correlation IDs

Every incoming request gets a unique correlation ID that flows through all log entries and downstream calls.

### Flow

```
Client → API Gateway → Service A → Service B
         (generates)   (propagates) (propagates)
         X-Correlation-Id: abc-123
```

### Middleware

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

export const correlationStorage = new AsyncLocalStorage<string>();

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const correlationId = req.headers['x-correlation-id'] ?? randomUUID();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    correlationStorage.run(correlationId, () => next());
  }
}
```

### Propagating to Downstream Services

```typescript
@Injectable()
export class HttpClient {
  async get(url: string) {
    const correlationId = correlationStorage.getStore();
    return fetch(url, {
      headers: { 'x-correlation-id': correlationId },
    });
  }
}
```

## Trace/Span Conventions

### OpenTelemetry Setup

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: process.env.SERVICE_NAME ?? 'my-service',
});

sdk.start();
```

### Span Naming Conventions

| Pattern                  | Example                      |
| ------------------------ | ---------------------------- |
| `HTTP {method} {route}`  | `HTTP GET /api/orders/:id`   |
| `{db}.{operation}`       | `postgres.query`             |
| `{service}.{method}`     | `OrderService.create`        |
| `{queue}.{operation}`    | `email-queue.publish`        |
| `{external}.{operation}` | `stripe.createPaymentIntent` |

### Custom Spans

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service');

async function processOrder(orderId: string) {
  return tracer.startActiveSpan('OrderService.processOrder', async (span) => {
    span.setAttribute('order.id', orderId);

    try {
      const result = await doWork(orderId);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

## Dashboard Recommendations

### Metrics to Display

| Category   | Metric                       | Alert Threshold     |
| ---------- | ---------------------------- | ------------------- |
| Latency    | p50, p95, p99 response time  | p99 > 2s            |
| Throughput | Requests per second          | Drop > 50% in 5 min |
| Errors     | 5xx rate                     | > 1% of requests    |
| Saturation | CPU, memory, connection pool | > 80% utilization   |
| Queue      | Queue depth, processing time | Depth > 1000        |
| Uptime     | Health check success rate    | < 99.9%             |

### Recommended Stack

| Component | Tool Options                               |
| --------- | ------------------------------------------ |
| Metrics   | Prometheus + Grafana, Datadog, CloudWatch  |
| Logging   | Loki + Grafana, ELK Stack, CloudWatch Logs |
| Tracing   | Jaeger, Tempo, AWS X-Ray, Datadog APM      |
| Alerting  | Grafana Alerts, PagerDuty, Opsgenie        |

### Key Dashboards to Build

1. **Service overview** -- request rate, error rate, latency percentiles
2. **Error drill-down** -- error codes, top error messages, affected endpoints
3. **Dependency health** -- database latency, external API response times
4. **Queue monitoring** -- queue depth, processing rate, failed jobs
5. **Infrastructure** -- CPU, memory, disk, network across all instances
