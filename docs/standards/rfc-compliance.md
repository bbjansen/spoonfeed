# RFC & Standards Compliance

This document tracks which RFCs and open standards spoonfeed implements, supports via recipes, or recommends.

## Implemented in Base Template

These are built into every generated project automatically.

| Standard    | Reference                                                                             | Implementation                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| RFC 9457    | [Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc9457)        | `GlobalExceptionFilter` returns `application/problem+json` with `type`, `title`, `status`, `detail`, `instance` fields |
| RFC 9110    | [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)                              | Correct HTTP status codes, method semantics via NestJS controllers                                                     |
| RFC 7807    | [Problem Details (superseded by 9457)](https://datatracker.ietf.org/doc/html/rfc7807) | Backward compatible — RFC 9457 is the successor                                                                        |
| RFC 6750    | [Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)                   | JWT auth recipe follows Bearer scheme                                                                                  |
| JSON Schema | [json-schema.org](https://json-schema.org/)                                           | `class-validator` + `ValidationPipe` for request validation                                                            |
| ETags       | [RFC 9110 Section 8.8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.8.3)        | `@fastify/etag` plugin generates ETags and handles `If-None-Match`                                                     |

## Implemented via Recipes

These are available when the corresponding recipe is selected.

| Standard               | Reference                                                                                                                      | Recipe             | Implementation                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------ |
| W3C Trace Context      | [w3c.org/TR/trace-context](https://www.w3.org/TR/trace-context/)                                                               | `opentelemetry`    | Automatic `traceparent`/`tracestate` header propagation                        |
| OpenTelemetry          | [opentelemetry.io](https://opentelemetry.io/)                                                                                  | `opentelemetry`    | Traces, metrics via `@opentelemetry/sdk-node`                                  |
| RFC 6585               | [Additional HTTP Status Codes](https://datatracker.ietf.org/doc/html/rfc6585)                                                  | `throttler`        | 429 Too Many Requests with `Retry-After` header                                |
| RFC 6749               | [OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)                                                                     | `passport`         | OAuth 2.0 flows via Passport strategies                                        |
| RFC 7519               | [JSON Web Tokens](https://datatracker.ietf.org/doc/html/rfc7519)                                                               | `jwt-auth`         | JWT creation, validation, refresh via `@nestjs/jwt`                            |
| RFC 8288               | [Web Linking](https://datatracker.ietf.org/doc/html/rfc8288)                                                                   | `pagination`       | `Link` header with `rel=first,prev,next,last` on paginated responses           |
| OpenAPI 3.x            | [spec.openapis.org](https://spec.openapis.org/oas/latest.html)                                                                 | `swagger`          | API documentation via `@nestjs/swagger`                                        |
| CORS                   | [Fetch Standard (WHATWG)](https://fetch.spec.whatwg.org/#http-cors-protocol)                                                   | `cors`             | `Access-Control-*` headers via Fastify CORS plugin                             |
| CSP                    | [W3C Content Security Policy](https://www.w3.org/TR/CSP3/)                                                                     | `helmet`           | Content-Security-Policy header via `@fastify/helmet`                           |
| HSTS                   | [RFC 6797](https://datatracker.ietf.org/doc/html/rfc6797)                                                                      | `helmet`           | `Strict-Transport-Security` header                                             |
| X-Content-Type-Options | [Fetch Standard](https://fetch.spec.whatwg.org/)                                                                               | `helmet`           | `nosniff` header prevents MIME type sniffing                                   |
| Referrer-Policy        | [W3C Referrer Policy](https://www.w3.org/TR/referrer-policy/)                                                                  | `helmet`           | Controls `Referer` header leakage                                              |
| CSRF                   | [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | `csrf`             | Token-based CSRF protection via `@fastify/csrf-protection`                     |
| RFC 7240               | [Prefer Header](https://datatracker.ietf.org/doc/html/rfc7240)                                                                 | `prefer-header`    | PreferInterceptor handles return=minimal, return=representation, respond-async |
| RFC 6902               | [JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902)                                                                    | `json-patch`       | JsonPatchValidationPipe validates RFC 6902 operations                          |
| RFC 7396               | [JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7396)                                                              | `json-merge-patch` | MergePatchValidationPipe for simple partial updates                            |
| RFC 9530               | [Content Digest](https://datatracker.ietf.org/doc/html/rfc9530)                                                                | `content-digest`   | Content-Digest/Repr-Digest response headers + verification guard               |
| RFC 9449               | [DPoP](https://datatracker.ietf.org/doc/html/rfc9449)                                                                          | `dpop`             | DPoPGuard validates proof-of-possession JWTs                                   |
| IETF draft             | [Idempotency-Key](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)                                 | `idempotency`      | Middleware caches and replays responses for duplicate keys                     |
| RFC 7234 / RFC 9111    | [HTTP Caching](https://datatracker.ietf.org/doc/html/rfc9111)                                                                  | `http-caching`     | Cache-Control, ETag, conditional request handling                              |

## Recommended Practices

These aren't specific RFCs but are industry-standard practices the boilerplate follows.

| Practice           | Reference                                                                                                           | Implementation                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Structured Logging | [12-Factor App: Logs](https://12factor.net/logs)                                                                    | Pino/Winston JSON logging with request context              |
| Health Checks      | [draft-inadarei-api-health-check](https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check)            | `/health` endpoint via `@nestjs/terminus`                   |
| Correlation IDs    | Best practice                                                                                                       | `x-correlation-id` header propagation via AsyncLocalStorage |
| Graceful Shutdown  | Best practice                                                                                                       | `enableShutdownHooks()` with connection draining            |
| Circuit Breaker    | Best practice                                                                                                       | Opossum circuit breaker for external calls                  |
| API Versioning     | Best practice                                                                                                       | URI-based versioning (`/v1/`, `/v2/`) via `@nestjs/common`  |
| Idempotency        | Best practice                                                                                                       | Implemented via `idempotency` recipe (see Recipes table)    |
| Rate Limit Headers | [IETF draft-ietf-httpapi-ratelimit-headers](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) | `RateLimit-*` headers via `@nestjs/throttler`               |

## Security Standards

| Standard                  | Reference                                                             | Implementation                                                         |
| ------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| OWASP API Security Top 10 | [owasp.org/API-Security](https://owasp.org/www-project-api-security/) | Addressed via helmet, CORS, throttler, auth, validation                |
| OWASP Top 10              | [owasp.org/Top10](https://owasp.org/www-project-top-ten/)             | Injection prevention (validation), broken auth (JWT), security headers |

## Operational Standards

These cross-cutting operational concerns are built into the base template or available via recipes.

| Concern                    | Implementation                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Request Timeout            | Timeout middleware aborts requests exceeding `REQUEST_TIMEOUT_MS` (default 30 000 ms), returns 408              |
| Graceful Shutdown          | `enableShutdownHooks()` drains in-flight requests, closes DB/queue connections, and respects `SIGTERM`/`SIGINT` |
| Health Check Probes        | `/health/live` (liveness), `/health/ready` (readiness), `/health/startup` (startup) via `@nestjs/terminus`      |
| SSRF Prevention            | Outbound HTTP calls validated against allow-listed hosts; private/link-local IP ranges blocked by default       |
| Input Sanitization         | `ValidationPipe` with `whitelist: true` strips unknown properties; `class-transformer` sanitizes inputs         |
| Connection Pool Management | TypeORM/Prisma pool sizes configurable via environment variables; pool exhaustion logged with Pino alerts       |

## Error Response Format (RFC 9457)

Every error response from the API follows RFC 9457 Problem Details:

```json
{
  "type": "urn:error:not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "User with ID 999 was not found",
  "instance": "/api/users/999",
  "traceCode": "A_NF_00001",
  "errorCode": "NOT_FOUND",
  "timestamp": "2024-01-07T12:00:34.567Z",
  "debugInformation": null
}
```

### Field Descriptions

| Field              | RFC 9457  | Description                                                     |
| ------------------ | :-------: | --------------------------------------------------------------- |
| `type`             | Required  | URI reference identifying the problem type (`urn:error:{code}`) |
| `title`            | Required  | Short summary of the problem type (e.g., "Not Found")           |
| `status`           | Required  | HTTP status code as integer                                     |
| `detail`           | Required  | Human-readable explanation specific to this occurrence          |
| `instance`         | Required  | The request path where the error occurred                       |
| `traceCode`        | Extension | Unique trace code for grep-searchable error identification      |
| `errorCode`        | Extension | Machine-readable error type (e.g., "NOT_FOUND")                 |
| `timestamp`        | Extension | ISO 8601 timestamp of the error                                 |
| `debugInformation` | Extension | Additional debug context (null in production)                   |

### Content-Type

Error responses use `Content-Type: application/problem+json` as specified by RFC 9457.

## RFCs Considered but Not Implemented

| Standard                       | Reference                                                             | Reason                                           |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------ |
| RFC 8631 (Link Relation Types) | [datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc8631) | Covered by OpenAPI documentation                 |
| RFC 7616 (Digest Auth)         | [datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc7616) | Obsolete for modern APIs — use JWT/OAuth instead |
