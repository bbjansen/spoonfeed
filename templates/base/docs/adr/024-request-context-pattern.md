# ADR-024: Request Context via AsyncLocalStorage (CLS)

## Status

Accepted

## Date

2026-05-01

## Context

Cross-cutting request data (correlation ID, authenticated user, tenant ID) must be available throughout the call chain — in services, repositories, interceptors, and event handlers. Two approaches exist in NestJS: REQUEST-scoped injection and continuation-local storage (CLS) via `AsyncLocalStorage`.

REQUEST-scoped providers force NestJS to create new instances of every dependent provider per request. This causes significant memory pressure and GC overhead under load, as the entire dependency subtree becomes request-scoped (the "scope bubble" problem).

## Decision

Use `nestjs-cls` (backed by Node.js `AsyncLocalStorage`) to propagate request context. Key design choices:

- **CLS store initialization:** a `ClsMiddleware` runs first in the middleware chain, creating the store and generating a correlation ID (from `x-correlation-id` header or UUID)
- **User and tenant enrichment:** a `ClsGuard` or interceptor populates `cls.set('user', ...)` and `cls.set('tenantId', ...)` after authentication
- **Access pattern:** services inject `ClsService` and call `cls.get('correlationId')` — no constructor parameters, no method parameter drilling
- **All providers remain DEFAULT scope:** no provider needs REQUEST scope, preserving singleton performance characteristics

## Consequences

### Positive

- Zero memory overhead per request — all providers remain singleton-scoped
- Correlation ID, user, and tenant are available anywhere in the call chain without parameter passing
- Works across async boundaries including `Promise.all`, `setTimeout`, and event emitters
- Compatible with Pino's request-scoped logging (ADR-017) — same correlation ID in both systems

### Negative

- `AsyncLocalStorage` is an implicit dependency — harder to trace data flow than explicit parameters
- CLS context is lost across worker threads and child processes unless explicitly propagated
- Developers unfamiliar with CLS may find the "magic" context confusing

### Risks

- CLS context loss in edge cases (native addons, some ORMs with custom connection pools) — mitigated by integration tests verifying context propagation

## Alternatives Considered

### REQUEST-scoped providers

- **Pros:** native NestJS pattern, explicit dependency injection
- **Cons:** every dependent provider becomes request-scoped, creating new instances per request; 30-50% throughput reduction in benchmarks
- **Why not:** performance cost is unacceptable for high-throughput services

## References

- Package: `nestjs-cls`
- Node.js API: `AsyncLocalStorage`
- ADR-017: Structured JSON Logging with Pino
