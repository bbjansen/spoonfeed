# Observability Recipes

spoonfeed provides 3 observability recipes covering distributed tracing, request logging, and trace context propagation. These recipes help you understand what your application is doing in production — from individual request logs to end-to-end distributed traces across services.

!!! tip "Recommended combinations"
    - **Full observability stack:** `opentelemetry` + `request-logging` + `distributed-tracing` + `correlation-id`
    - **Minimal logging:** `request-logging` + `pino` or `winston`

---

## OpenTelemetry

Distributed tracing and metrics with the OpenTelemetry SDK. Auto-instruments HTTP, database, and external call spans.

| | |
| --- | --- |
| **ID** | `opentelemetry` |
| **Dependencies** | `@opentelemetry/sdk-node` `@opentelemetry/exporter-trace-otlp-http` `@opentelemetry/instrumentation-http` `@opentelemetry/instrumentation-fastify` `@opentelemetry/resources` `@opentelemetry/semantic-conventions` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OpenTelemetry collector endpoint |
| `OTEL_SERVICE_NAME` | `nestjs-app` | Service name for traces |

**Usage:** OpenTelemetry is initialized in `src/instrumentation.ts`, loaded before app bootstrap via the `--require` flag. Auto-instrumentation captures HTTP, database, and external call spans automatically. Add custom spans with `tracer.startSpan()`. Export to Jaeger or any OTLP-compatible collector.

!!! tip
    Use custom spans for business-critical operations to get visibility into domain-specific performance.

!!! warning "Requires an OTLP-compatible collector"
    You need a trace collector (Jaeger, Grafana Tempo, Datadog Agent, etc.) running at `OTEL_EXPORTER_OTLP_ENDPOINT`. The `docker-compose-dev` recipe can include a Jaeger instance for local development.

**Pairs well with:** `distributed-tracing`, `request-logging`, `correlation-id`

---

## Request Logging

HTTP request/response logging middleware. Captures method, URL, status code, and response duration for every request.

| | |
| --- | --- |
| **ID** | `request-logging` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `REQUEST_LOG_BODY` | `false` | Log request/response bodies |

**Usage:** The middleware is applied globally. Logs include HTTP method, URL, status code, and response time. Body logging is opt-in via `REQUEST_LOG_BODY=true`.

!!! warning
    Disable body logging in production to avoid logging PII. Redact sensitive fields (password, token) if body logging is enabled.

---

## Distributed Tracing

Trace context propagation across services via W3C Trace Context headers.

| | |
| --- | --- |
| **ID** | `distributed-tracing` |
| **Compatible with** | All project types |

**Usage:** W3C Trace Context headers (`traceparent`, `tracestate`) are propagated across service calls. Middleware extracts incoming trace context. The `HttpService` wrapper forwards trace headers to all outgoing requests.

!!! note
    Combine with the `opentelemetry` recipe for full end-to-end tracing with a collector and visualization.
