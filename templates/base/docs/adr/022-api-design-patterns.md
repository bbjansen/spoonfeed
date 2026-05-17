# ADR-022: API Design Patterns as Opt-In Recipes

## Status

Accepted

## Date

2026-04-01

## Context

Production APIs need patterns like pagination, filtering, caching, and idempotency. However, not every API needs every pattern. Baking all patterns into the base template would add complexity and dependencies that many projects never use.

## Decision

Provide API design patterns as individual opt-in recipes, each implementing a well-defined RFC or industry standard:

| Recipe           | Standard                | Description                                                                    |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `pagination`     | RFC 8288 (Web Linking)  | Cursor and offset pagination with `Link` header navigation                     |
| `filtering`      | Custom (JSON query DSL) | Type-safe query filtering with `class-validator` DTOs                          |
| `api-versioning` | URI + Header            | URI prefix (`/v1/`) and `Accept-Version` header strategies                     |
| `correlation-id` | Custom                  | `x-correlation-id` header propagation via `AsyncLocalStorage`                  |
| `idempotency`    | Idempotency-Key header  | Request deduplication with configurable storage (Redis/database)               |
| `http-caching`   | RFC 9111                | `Cache-Control`, `ETag`, and conditional request support                       |
| `prefer-header`  | RFC 7240                | `Prefer: return=minimal`, `respond-async` handling                             |
| `json-patch`     | RFC 6902                | JSON Patch operations for partial resource updates                             |
| `sse`            | EventSource API         | Server-Sent Events for real-time unidirectional streaming                      |
| `webhooks`       | Custom                  | Webhook dispatch with retry, signing (`content-digest`), and delivery tracking |

Each recipe provides:

- A NestJS module or decorator that can be imported per-controller
- DTOs with `class-validator` decorators for input validation
- Integration tests demonstrating correct behavior
- CLAUDE.md documentation for AI-assisted development

## Consequences

### Positive

- APIs adopt only the patterns they need — no unused middleware or decorators
- Each pattern follows an established RFC, ensuring interoperability
- Recipes include tests and documentation, reducing implementation errors
- Patterns are composable — `pagination` + `filtering` + `http-caching` work together

### Negative

- Developers must know which recipes to select — requires familiarity with API design patterns
- Some recipes depend on others (e.g., `webhooks` benefits from `correlation-id`)
- Recipe-per-pattern granularity means more items in the CLI selection prompt

### Risks

- RFC compliance drift as recipes evolve — mitigated by linking to the relevant RFC in each recipe's README and validating compliance in integration tests

## References

- [RFC 8288 — Web Linking](https://www.rfc-editor.org/rfc/rfc8288)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [RFC 7240 — Prefer Header](https://www.rfc-editor.org/rfc/rfc7240)
- [RFC 6902 — JSON Patch](https://www.rfc-editor.org/rfc/rfc6902)
- ADR-008: Composable Recipe System
