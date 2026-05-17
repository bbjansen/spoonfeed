# ADR-009: RFC and Standards Compliance by Default

## Status

Accepted

## Date

2026-03-10

## Context

APIs built without standards compliance create integration friction for consumers, fail security audits, and require rework when standards are eventually adopted. Retrofitting RFC compliance is expensive.

## Decision

Implement key RFCs and open standards in the base template and recipes:

**Base template (every project):**

- RFC 9457 — Problem Details error responses (`application/problem+json`)
- RFC 9110 — ETags via `@fastify/etag`
- Graceful shutdown hooks
- Request timeout middleware

**Via recipes:**

- RFC 8288 — Link headers for pagination
- RFC 9111 — Cache-Control headers
- RFC 7240 — Prefer header
- RFC 7662 — OAuth 2.0 Token Introspection
- RFC 9449 — DPoP proof-of-possession
- RFC 9530 — Content Digest integrity
- RFC 6902/7396 — JSON Patch / JSON Merge Patch
- W3C Trace Context — via OpenTelemetry
- OWASP API Security Top 10 — via security recipes

## Consequences

### Positive

- API consumers get predictable, standardized responses
- Error responses parse correctly in any RFC 9457-aware client
- ETags reduce bandwidth by enabling conditional requests
- Security headers (Helmet, CORS, CSRF) pass audit checklists

### Negative

- Slightly larger response payloads (RFC 9457 has more fields than a minimal error)
- Teams must understand the standards to use extensions correctly

## References

- [RFC 9457](https://datatracker.ietf.org/doc/html/rfc9457)
- [docs/standards/rfc-compliance.md](../../../docs/standards/rfc-compliance.md)
