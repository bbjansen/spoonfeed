# API Pattern Recipes

spoonfeed provides 15 API pattern recipes covering pagination, versioning, patching, caching, real-time streaming, file handling, and more. These recipes add common HTTP API behaviors through decorators, pipes, interceptors, and middleware — no boilerplate wiring required.

!!! tip "Recommended combinations"
    - **Production-ready REST API:** `pagination` + `filtering` + `api-versioning` + `correlation-id` + `http-caching`
    - **Partial update support:** `json-patch` or `json-merge-patch` (pick one)
    - **Real-time features:** `sse` for server-to-client, `websockets` for bidirectional
    - **Resilient mutations:** `idempotency` + `correlation-id`

---

## Pagination

Cursor and offset pagination utilities.

| | |
| --- | --- |
| **ID** | `pagination` |
| **Dependencies** | `@nestjs/swagger` |
| **Compatible with** | All project types |

**Usage:** Use `PaginatedQuery` for query params (`page`, `limit`). `PaginatedResponse<T>` wraps results with metadata. The `@Paginate()` decorator extracts and validates pagination from the request. Supports both offset-based and cursor-based pagination. Prefer cursor-based for large datasets.

```typescript
import { Controller, Get } from '@nestjs/common';
import { Paginate } from '@/shared/decorators/paginate.decorator';
import { PaginatedQuery, PaginatedResponse } from '@/shared/dto/pagination.dto';
import { UserService } from './user.service';
import { User } from './user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  async list(@Paginate() query: PaginatedQuery): Promise<PaginatedResponse<User>> {
    const [items, total] = await this.users.findAll(query.skip, query.limit);
    return new PaginatedResponse(items, total, query.page, query.limit);
  }
}
```

**Pairs well with:** `filtering`, `api-versioning`, `http-caching`

---

## Filtering

Dynamic query filtering utilities.

| | |
| --- | --- |
| **ID** | `filtering` |
| **Dependencies** | `@nestjs/swagger` |
| **Compatible with** | All project types |

**Usage:** Extend `FilterDto` for resource-specific filters. Supports `eq`, `contains`, `gt`, `lt`, `in` operators. Map filter DTOs to ORM query conditions in the service layer.

---

## API Versioning

URI or header-based API versioning.

| | |
| --- | --- |
| **ID** | `api-versioning` |
| **Compatible with** | All project types |

**Usage:** URI versioning is enabled: `/v1/resource`, `/v2/resource`. Apply `@Version()` on controllers. Default version is set in `main.ts`. Use `VERSION_NEUTRAL` for unversioned routes.

---

## Correlation ID

Request correlation ID propagation via `AsyncLocalStorage`.

| | |
| --- | --- |
| **ID** | `correlation-id` |
| **Compatible with** | All project types |

**Usage:** Every request gets a correlation ID from the `x-correlation-id` header or an auto-generated UUID. Access anywhere in the async call chain via `getCorrelationId()`. Propagate to downstream HTTP calls and log entries.

```typescript
import { Controller, Get, Logger } from '@nestjs/common';
import { getCorrelationId } from '@/shared/middleware/correlation-id.middleware';

@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  @Get()
  findAll() {
    this.logger.log(`Fetching orders [correlationId=${getCorrelationId()}]`);
    // correlation ID is also forwarded to downstream HTTP calls automatically
  }
}
```

**Pairs well with:** `request-logging`, `distributed-tracing`, `opentelemetry`

---

## HTTP Cache Headers

RFC 9111 Cache-Control and conditional request headers.

| | |
| --- | --- |
| **ID** | `http-caching` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** Apply `@CacheControl()` decorator on GET endpoints to set `Cache-Control` headers. Supports `max-age`, `s-maxage`, `stale-while-revalidate`, `no-cache`, `no-store`, `private`, `public` directives. Use `no-cache` or `private` for authenticated endpoints.

---

## Idempotency Key

Idempotency-Key header support for safe request retries (IETF draft).

| | |
| --- | --- |
| **ID** | `idempotency` |
| **Compatible with** | HTTP API, AWS Lambda, Full-Stack, Monorepo |

**Usage:** Apply `@Idempotent()` decorator on POST/PUT endpoints. Clients send an `Idempotency-Key` header. Responses are cached and replayed for duplicate keys. Uses in-memory cache by default; Redis recommended for production.

!!! note
    For multi-instance deployments, pair with `redis-cache` to share the idempotency store across instances.

**Pairs well with:** `redis-cache`, `correlation-id`

---

## Prefer Header

RFC 7240 Prefer header for `return=representation` and `respond-async`.

| | |
| --- | --- |
| **ID** | `prefer-header` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** The `PreferInterceptor` parses the `Prefer` request header and applies:

- `return=minimal` — returns 204 No Content
- `return=representation` — returns the full body
- `respond-async` — handles asynchronous processing

Applied preferences are echoed in the `Preference-Applied` response header.

---

## JSON Patch

RFC 6902 JSON Patch for granular document updates.

| | |
| --- | --- |
| **ID** | `json-patch` |
| **Dependencies** | `fast-json-patch` |
| **Conflicts** | `json-merge-patch` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** Use `JsonPatchValidationPipe` on PATCH endpoints that accept `application/json-patch+json`. The pipe validates the operation array (`add`, `remove`, `replace`, `move`, `copy`, `test`). Apply patches with `fast-json-patch`.

---

## JSON Merge Patch

RFC 7396 JSON Merge Patch for simple partial updates.

| | |
| --- | --- |
| **ID** | `json-merge-patch` |
| **Conflicts** | `json-patch` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** Use `MergePatchValidationPipe` on PATCH endpoints that accept `application/merge-patch+json`. The body must be a plain JSON object. Null values in the patch delete the corresponding key from the target. Nested objects are merged recursively.

---

## Server-Sent Events

Lightweight real-time server-to-client streaming. No extra dependencies.

| | |
| --- | --- |
| **ID** | `sse` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** Use `@Sse()` decorator on controller methods to return an `Observable<MessageEvent>`. Push events from services via a `Subject`. SSE is server-to-client only — use WebSockets for bidirectional communication.

---

## Request Context (CLS)

`AsyncLocalStorage`-based request context via `nestjs-cls`.

| | |
| --- | --- |
| **ID** | `request-context` |
| **Dependencies** | `nestjs-cls` |
| **Compatible with** | All project types |

**Usage:** Import `RequestContextModule` in `AppModule`. Inject `ClsService` to access `correlationId`, `userId`, and `ip` anywhere in the request lifecycle. Context is populated automatically via middleware.

---

## Internationalization

Multi-language support with `nestjs-i18n`.

| | |
| --- | --- |
| **ID** | `i18n` |
| **Dependencies** | `nestjs-i18n` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** Translation files live in `src/i18n/<lang>/`. Language is resolved from the `lang` query parameter or the `Accept-Language` header. Fallback language is `en`. Inject `I18nService` for translations.

---

## Response Serialization Groups

Return different field sets based on role or endpoint.

| | |
| --- | --- |
| **ID** | `serialization-groups` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** Apply `Serialize(DtoClass)` decorator on controller methods. Mark DTO properties with `@Expose()` and optionally `{ groups: [...] }` for role-based field visibility. Fields without `@Expose()` are excluded.

---

## Webhook Delivery

Outbound webhook system with HMAC signing and retry.

| | |
| --- | --- |
| **ID** | `webhooks` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `WEBHOOK_SECRET` | `change-me` | HMAC secret for webhook signatures |

**Usage:** `WebhookService` delivers outbound webhooks signed with HMAC-SHA256. Signature is sent in the `X-Webhook-Signature` header. Consumers verify by computing HMAC of the raw body.

---

## File Upload

Multipart file upload with validation and streaming.

| | |
| --- | --- |
| **ID** | `file-upload` |
| **Dependencies** | `@fastify/multipart` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `MAX_FILE_SIZE_MB` | `50` | Max upload size in MB |

**Usage:** Register `@fastify/multipart` in `main.ts`. Use `FileUploadInterceptor` on upload routes. Validate files with `FileValidationPipe` for allowed MIME types and max size.

**Pairs well with:** `aws-s3`, `gcp-cloud-storage`, `azure-blob-storage`
