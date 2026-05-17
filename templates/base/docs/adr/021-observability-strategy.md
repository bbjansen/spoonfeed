# ADR-021: Observability Strategy with OpenTelemetry

## Status

Accepted

## Date

2026-04-01

## Context

Production services require observability across three pillars: logs, traces, and metrics. Without a standardized approach, teams implement ad-hoc solutions that are inconsistent across services and difficult to correlate during incident response.

## Decision

Adopt OpenTelemetry (OTel) as the observability standard with the following components:

### Tracing

- `@opentelemetry/sdk-node` with auto-instrumentation for HTTP, database, and cache clients
- W3C Trace Context (`traceparent` header) for distributed trace propagation
- Trace IDs injected into Pino log lines via `nestjs-pino` for log-trace correlation

### Metrics

- `@opentelemetry/sdk-metrics` exporting to Prometheus via `/metrics` endpoint
- Default metrics: request duration histograms, error rate counters, active connection gauges
- Database connection pool metrics (pool size, idle, waiting) via custom instrumentation
- `@nestjs/terminus` health checks: liveness (`/health/live`), readiness (`/health/ready`), startup (`/health/startup`)

### Error Tracking

- Sentry (`@sentry/nestjs`) for error aggregation, release tracking, and performance monitoring
- Available as the `sentry` recipe — not baked into the base template
- Source maps uploaded to Sentry during CI/CD build stage

### Request Logging

- Request/response logging middleware via `nestjs-pino` with correlation ID propagation
- Configurable log sampling for high-traffic endpoints

## Consequences

### Positive

- OpenTelemetry is vendor-neutral — exporters can target Jaeger, Datadog, New Relic, or cloud-native backends
- W3C Trace Context ensures trace propagation works across any OTel-instrumented service
- Health check probes integrate with Kubernetes liveness/readiness/startup probe configuration
- Connection pool monitoring catches resource exhaustion before it causes outages

### Negative

- OpenTelemetry SDK adds startup overhead and memory for span collection
- Auto-instrumentation can generate high trace volume — requires sampling configuration
- Prometheus `/metrics` endpoint must be secured in production (not exposed publicly)

### Risks

- OpenTelemetry Node.js SDK maturity — some instrumentations are still in beta; mitigated by pinning to stable releases

## References

- [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- Packages: `@opentelemetry/sdk-node`, `@opentelemetry/sdk-metrics`, `@nestjs/terminus`, `@sentry/nestjs`
- Recipes: `sentry`, `datadog`, `prometheus`
- ADR-017: Logging Strategy
