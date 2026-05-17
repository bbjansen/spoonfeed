# ADR-018: Defense-in-Depth Security Architecture

## Status

Accepted

## Date

2026-04-01

## Context

APIs are exposed to the public internet and face a wide range of attack vectors. A single security mechanism is insufficient — the OWASP API Security Top 10 requires multiple layers of defense applied consistently across all scaffolded projects.

## Decision

Implement a defense-in-depth approach with the following layers enabled by default in the base template:

| Layer            | Implementation                                             | OWASP Mapping |
| ---------------- | ---------------------------------------------------------- | ------------- |
| Security headers | `@fastify/helmet`                                          | API1, API7    |
| CORS             | `@fastify/cors` with explicit origin allowlist             | API7          |
| CSRF protection  | `@fastify/csrf-protection` (stateful endpoints)            | API2          |
| Rate limiting    | `@nestjs/throttler` with configurable windows              | API4          |
| Input validation | `class-validator` + `class-transformer` on all DTOs        | API3, API8    |
| Request timeouts | Fastify `connectionTimeout` + `requestTimeout`             | API4          |
| Payload limits   | Fastify `bodyLimit` (default 1MB)                          | API4          |
| SSRF prevention  | URL allowlist validation in HTTP-calling services          | API7          |
| Content digest   | `content-digest` header verification for webhook receivers | API2          |

Additional security recipes available:

- `api-key-auth` — API key validation via custom guard
- `oauth2` — OAuth 2.0 / OpenID Connect integration
- `mTLS` — mutual TLS for service-to-service communication

## Consequences

### Positive

- All projects start with a secure baseline — security is opt-out, not opt-in
- OWASP API Security Top 10 coverage documented and mapped per control
- `class-validator` decorators on DTOs enforce validation at the boundary, preventing injection
- Rate limiting prevents brute-force and DoS attacks at the application layer

### Negative

- Default security controls may be too restrictive for internal-only APIs (CORS, CSRF)
- Rate limiting configuration requires tuning per endpoint — defaults may not fit all use cases
- Helmet's CSP defaults can break frontend assets if not configured correctly in full-stack projects

### Risks

- False sense of security — application-level controls do not replace network-level security (WAF, VPC)
- Misconfigured CORS allowlists — mitigated by requiring explicit origins, rejecting `*` in production

## References

- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- Packages: `@fastify/helmet`, `@fastify/cors`, `@fastify/csrf-protection`, `@nestjs/throttler`, `class-validator`
- ADR-004: Authentication Architecture
