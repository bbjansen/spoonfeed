# ADR-023: Typed Error Class Hierarchy

## Status

Accepted

## Date

2026-05-01

## Context

NestJS provides `HttpException` and its subclasses (`NotFoundException`, `BadRequestException`, etc.) for throwing HTTP errors. However, these are HTTP-layer concerns — using them in domain services couples business logic to the HTTP transport. Services that throw `HttpException` cannot be reused in message consumers, CLI commands, or gRPC handlers without dragging in HTTP semantics.

## Decision

Implement a typed error hierarchy rooted at `ApplicationError`:

- **`ApplicationError`** — abstract base with `message`, `traceCode`, and optional `debugInformation`
- **`ValidationError`** — input validation failures (maps to 400)
- **`NotFoundError`** — requested resource does not exist (maps to 404)
- **`ForbiddenError`** — authenticated user lacks permission (maps to 403)
- **`InvalidRequestError`** — structurally valid but semantically invalid request (maps to 422)
- **`RequesterError`** — upstream/third-party service returned an error (maps to 502)

Key design choices:

- **Static trace codes:** each error instance carries a `traceCode` (e.g., `USR_001`) that is grep-searchable across the codebase, enabling instant error origin identification in logs and monitoring
- **`debugInformation` separation:** debug context (stack traces, internal state) is attached to the error but excluded from production API responses via the exception filter, preventing information leakage
- **Transport-agnostic mapping:** the global exception filter maps `ApplicationError` subclasses to HTTP status codes; a separate gRPC or message handler filter can map the same errors to its own status codes

## Consequences

### Positive

- Domain services remain transport-agnostic and reusable across HTTP, gRPC, and message consumers
- Trace codes enable instant error location via `grep -r "USR_001"` across the entire codebase
- Debug information is available in development and logging but never leaked to API consumers in production
- Type-safe error handling — callers can catch specific error types rather than checking status codes

### Negative

- Additional class hierarchy to maintain alongside NestJS built-in exceptions
- Developers must remember to throw `ApplicationError` subclasses instead of `HttpException`
- Exception filter mapping logic must be kept in sync with new error types

### Risks

- Inconsistent adoption — mitigated by ESLint rule banning direct `HttpException` usage in service files

## References

- ADR-002: RFC 9457 Problem Details for Error Responses
- Package: `@nestjs/common` (exception filters)
