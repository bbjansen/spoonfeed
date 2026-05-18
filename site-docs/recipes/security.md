# Security Recipes

spoonfeed provides 6 security recipes covering HTTP headers, request protection, content integrity, and data privacy. Apply these recipes to harden your API against common attack vectors. Most require no external services and add protection through guards, interceptors, and middleware.

!!! tip "Recommended baseline"
    Every production API should include at minimum: `throttler` + `helmet` + `cors`. Add `csrf` for browser-facing applications and `data-masking` for apps that handle PII.

---

## Rate Limiting

Request rate limiting with `@nestjs/throttler`.

| | |
| --- | --- |
| **ID** | `throttler` |
| **Dependencies** | `@nestjs/throttler` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `THROTTLE_TTL` | `60000` | Rate limit window in milliseconds |
| `THROTTLE_LIMIT` | `100` | Max requests per window |

**Usage:** `ThrottlerGuard` is applied globally. Override per-route with `@Throttle()`. Skip rate limiting on specific routes with `@SkipThrottle()`.

!!! tip
    Use `@SkipThrottle()` on health check endpoints to prevent false 429 responses from liveness probes.

---

## Helmet

HTTP security headers with `@fastify/helmet`. Sets Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, and other protective headers automatically.

| | |
| --- | --- |
| **ID** | `helmet` |
| **Dependencies** | `@fastify/helmet` |
| **Compatible with** | All project types |

**Usage:** Helmet is registered as a Fastify plugin in `main.ts`. Customize CSP directives in the registration options.

!!! note
    If using Swagger UI, ensure CSP allows the required script and style sources.

---

## CORS

Cross-Origin Resource Sharing configuration.

| | |
| --- | --- |
| **ID** | `cors` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin(s), comma-separated |

**Usage:** CORS is configured in `main.ts`. Use comma-separated values for multiple origins. Never use `*` in production.

---

## CSRF Protection

Cross-Site Request Forgery protection for Fastify using cookie-based tokens.

| | |
| --- | --- |
| **ID** | `csrf` |
| **Dependencies** | `@fastify/csrf-protection` `@fastify/cookie` |
| **Compatible with** | All project types |

**Usage:** CSRF tokens are required for state-changing requests. Token is set via cookie. API endpoints using JWT or API key auth can be excluded from CSRF protection — it is primarily needed for browser-facing forms.

---

## Content Digest

RFC 9530 content integrity verification via digest headers.

| | |
| --- | --- |
| **ID** | `content-digest` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** `ContentDigestInterceptor` adds SHA-256 `Content-Digest` and `Repr-Digest` response headers for payload integrity. `ContentDigestGuard` optionally validates inbound `Content-Digest` headers on requests.

---

## Data Masking

Automatic PII redaction in logs and API responses.

| | |
| --- | --- |
| **ID** | `data-masking` |
| **Compatible with** | All project types |

**Usage:**

- Apply `@Sensitive()` decorator on DTO properties to mask values in API responses (applied during serialization via `class-transformer`)
- Use `maskEmail()`, `maskPhone()`, `maskCreditCard()`, `maskIban()` utilities for manual masking in log statements

!!! warning
    Never log raw PII. Always mask before writing to logs.

**Pairs well with:** `pino` or `winston`, `request-logging`
