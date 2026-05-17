# ADR-004: Composable Authentication via Recipes

## Status

Accepted

## Date

2026-02-01

## Context

Authentication requirements vary widely: some projects need JWT only, others need social OAuth, some need 2FA/MFA, enterprise projects need RBAC with fine-grained permissions.

## Decision

Provide authentication as composable recipes that can be combined:

- `jwt-auth` — Base JWT with access/refresh tokens
- `passport` — Multi-strategy Passport.js support
- `api-keys` — API key authentication for service-to-service
- `oauth-google/github/apple` — Social login strategies
- `oauth2-introspection` — RFC 7662 opaque token validation
- `dpop` — RFC 9449 proof-of-possession
- `rbac-casl` — Role-based access control with CASL
- `auth-flows` — Signup, email verification, password reset
- `mfa-totp` — Two-factor authentication with TOTP

## Consequences

### Positive

- Teams pick exactly what they need — no unused auth code
- Each recipe is independently testable and documented
- Social OAuth strategies follow identical Passport patterns for consistency

### Negative

- Some recipes depend on others (`auth-flows` requires `jwt-auth`)
- Teams must understand which recipes to combine for their use case

### Risks

- Misconfigured auth is a security risk — mitigated by documentation and sensible defaults
