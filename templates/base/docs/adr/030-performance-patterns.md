# ADR-030: Performance Patterns (Workers, Circuit Breaker, Caching, Load Testing)

## Status

Accepted

## Date

2026-05-01

## Context

Node.js is single-threaded — CPU-intensive operations block the event loop and degrade throughput. External service calls can cascade failures when a dependency is unavailable. Without load testing, performance regressions reach production undetected.

## Decision

Provide a set of performance recipes that address common bottlenecks:

### Worker Threads for CPU-intensive tasks

- Use `worker_threads` for operations exceeding 50ms CPU time (PDF generation, image processing, CSV parsing)
- `WorkerPool` manages reusable workers; communication via `MessagePort` with serializable data only

### Circuit Breaker (opossum)

- Wrap external calls with `opossum`; open after 5 failures in 30s, half-open retry after 10s
- Fallback functions provide degraded responses when circuit is open; state changes emit monitoring events

### Connection Pool Sizing and ETags

- Database pool: `(CPU cores * 2) + 1` baseline; HTTP clients: `keepAlive: true` with bounded `maxSockets`
- `EtagInterceptor` returns `304 Not Modified` for unchanged responses, reducing bandwidth

### Request Timeout and Load Testing

- Global timeout middleware (default 30s) returns `408` with Problem Details response (ADR-002)
- k6 scripts in `test/load/` for smoke, load, stress, and soak scenarios; smoke tests run per PR in CI

## Consequences

### Positive

- Worker threads keep the event loop responsive during CPU-intensive operations
- Circuit breakers prevent cascade failures; ETags reduce bandwidth costs
- k6 integration catches performance regressions before production deployment

### Negative

- Worker pool adds memory overhead (each worker is a separate V8 isolate)
- Circuit breaker thresholds require per-dependency tuning

### Risks

- Misconfigured circuit breaker thresholds — mitigated by monitoring alerts on circuit state changes

## References

- ADR-002: RFC 9457 Problem Details for Error Responses
- ADR-017: Structured JSON Logging with Pino
- Packages: `opossum`, `k6`; Node.js API: `worker_threads`
