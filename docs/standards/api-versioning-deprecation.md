# API Versioning and Deprecation

## Versioning Strategy

Use **URI-based versioning** as the primary strategy. It is explicit, easy to route, and straightforward for consumers.

```
GET /api/v1/orders
GET /api/v2/orders
```

### NestJS Configuration

```typescript
// main.ts
import { VersioningType } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
  prefix: 'v',
});
```

### Controller Versioning

```typescript
@Controller('orders')
@Version('1')
export class OrderV1Controller {
  @Get()
  findAll() {
    return this.orderService.findAllV1();
  }
}

@Controller('orders')
@Version('2')
export class OrderV2Controller {
  @Get()
  findAll() {
    // V2 returns a different response shape
    return this.orderService.findAllV2();
  }
}
```

### Per-Endpoint Versioning

When only a single endpoint changes between versions:

```typescript
@Controller('orders')
export class OrderController {
  @Get()
  @Version('1')
  findAllV1() {
    return this.orderService.findAllV1();
  }

  @Get()
  @Version('2')
  findAllV2() {
    return this.orderService.findAllV2();
  }

  // Shared across all versions
  @Get(':id')
  @Version(['1', '2'])
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }
}
```

### Version Comparison

| Strategy   | Format                                | Pros                   | Cons                    |
| ---------- | ------------------------------------- | ---------------------- | ----------------------- |
| URI        | `/api/v1/orders`                      | Explicit, easy routing | URL changes per version |
| Header     | `X-API-Version: 1`                    | Clean URLs             | Hidden, harder to test  |
| Media Type | `Accept: application/vnd.api.v1+json` | RESTful                | Complex, rarely used    |

## Deprecation Notices

### Timeline

| Phase    | Duration | Action                                 |
| -------- | -------- | -------------------------------------- |
| Announce | Day 0    | Add deprecation headers, update docs   |
| Warning  | 3 months | Log usage, notify consumers directly   |
| Sunset   | 6 months | Return 410 Gone, remove implementation |

### Deprecation Response Headers

Add these headers to responses from deprecated endpoints:

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(
    private readonly sunsetDate: string,
    private readonly alternative: string,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const response = context.switchToHttp().getResponse();
    response.header('Deprecation', 'true');
    response.header('Sunset', this.sunsetDate);
    response.header('Link', `<${this.alternative}>; rel="successor-version"`);
    return next.handle();
  }
}
```

Usage on a controller:

```typescript
@Controller('orders')
@Version('1')
@UseInterceptors(new DeprecationInterceptor('2026-12-01T00:00:00Z', '/api/v2/orders'))
export class OrderV1Controller {
  // All V1 endpoints return deprecation headers
}
```

## Sunset Headers

The `Sunset` header (RFC 8594) tells consumers when an API version will be removed.

### Response Example

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Dec 2026 00:00:00 GMT
Link: </api/v2/orders>; rel="successor-version"
Content-Type: application/json
```

### After Sunset

Once the sunset date passes, return `410 Gone`:

```typescript
@Controller('orders')
@Version('1')
export class OrderV1Controller {
  @Get()
  findAll() {
    throw new GoneException({
      errorCode: 'API_VERSION_SUNSET',
      message: 'API v1 has been removed. Use /api/v2/orders instead.',
      successor: '/api/v2/orders',
      sunsetDate: '2026-12-01',
    });
  }
}
```

## Migration Guides for Consumers

When introducing a new API version, provide a migration guide that covers:

### Guide Structure

1. **What changed** -- list every breaking change with before/after examples
2. **Why it changed** -- business or technical rationale
3. **How to migrate** -- step-by-step instructions
4. **Timeline** -- deprecation and sunset dates

### Example Migration Guide

```markdown
## Migrating from v1 to v2: Orders API

### Breaking Changes

| Endpoint        | Change                                            |
| --------------- | ------------------------------------------------- |
| GET /orders     | Response wrapped in `{ data, meta }` envelope     |
| POST /orders    | `productId` renamed to `product_id` (snake_case)  |
| GET /orders/:id | `created_at` is now ISO 8601 (was Unix timestamp) |

### Before (v1)

    GET /api/v1/orders
    Response: [{ "id": "1", "productId": "abc", "created_at": 1672531200 }]

### After (v2)

    GET /api/v2/orders
    Response: {
      "data": [{ "id": "1", "product_id": "abc", "created_at": "2023-01-01T00:00:00Z" }],
      "meta": { "total": 1, "page": 1, "pageSize": 20 }
    }

### Timeline

- 2026-06-01: v2 available, v1 deprecated
- 2026-09-01: v1 usage warnings sent to consumers
- 2026-12-01: v1 sunset, returns 410 Gone
```

### Communicating Deprecation

- Add deprecation notice to API documentation (Swagger/OpenAPI)
- Send direct notification to known API consumers
- Log v1 usage to identify consumers that need to migrate
- Include deprecation headers on all v1 responses
