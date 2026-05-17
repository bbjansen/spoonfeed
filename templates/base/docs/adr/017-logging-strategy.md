# ADR-017: Structured JSON Logging with Pino

## Status

Accepted

## Date

2026-04-01

## Context

Production applications need structured, machine-parseable logs for integration with cloud log aggregators (CloudWatch, Stackdriver, Azure Monitor). NestJS's default `ConsoleLogger` outputs unstructured text that is difficult to query, filter, and alert on.

## Decision

Use Pino (`nestjs-pino`) as the default logging library with structured JSON output. Key design choices:

- **Request context propagation:** `nestjs-pino` auto-attaches a correlation ID (`x-correlation-id` header or generated UUID) to every log line within a request lifecycle via `AsyncLocalStorage`
- **Log levels:** configurable via `LOG_LEVEL` environment variable (default: `info` in production, `debug` in development)
- **Pretty printing:** `pino-pretty` enabled in development via `NODE_ENV` detection for human-readable output
- **Redaction:** sensitive fields (`password`, `authorization`, `cookie`) are redacted from log output by default

Winston is available as an alternative via the `winston-logger` recipe for teams with existing Winston infrastructure.

## Consequences

### Positive

- JSON logs are natively queryable in all major cloud log aggregators
- Correlation IDs enable end-to-end request tracing across services
- Pino's low-overhead design (worker-thread serialization) has minimal impact on request latency
- Automatic request/response logging via `nestjs-pino` middleware eliminates manual log calls

### Negative

- JSON output is harder to read in local development without `pino-pretty`
- Pino's opinionated API differs from Winston — existing Winston log patterns need adaptation
- Redaction configuration must be maintained as new sensitive fields are added

### Risks

- Log volume costs in cloud environments — mitigated by appropriate log level configuration and sampling

## Alternatives Considered

### Winston

- **Pros:** Most popular Node.js logger, flexible transports, wide adoption
- **Cons:** Higher overhead per log call, synchronous serialization, less NestJS integration
- **Why not:** Pino's performance advantage matters for high-throughput services; Winston available via recipe

### NestJS ConsoleLogger

- **Pros:** Zero dependencies, built-in
- **Cons:** Unstructured text, no correlation IDs, no JSON output
- **Why not:** Unsuitable for production log aggregation

## References

- Packages: `nestjs-pino`, `pino`, `pino-pretty`, `pino-http`
- Recipe: `winston-logger`
- ADR-021: Observability Strategy
