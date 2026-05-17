# Idempotency Key Middleware

Implements the [Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) draft specification for safe POST and PUT request retries.

## How it works

The middleware intercepts POST and PUT requests that include an `Idempotency-Key` header. When a request is processed for the first time, the response is cached against the key. Subsequent requests with the same key replay the cached response instead of re-executing the handler.

## Setup

Apply the middleware in your `AppModule`:

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { IdempotencyMiddleware } from '@/shared/middleware/idempotency.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IdempotencyMiddleware).forRoutes('*');
  }
}
```

Optionally mark specific endpoints with the `@Idempotent()` decorator for documentation and guard purposes:

```typescript
import { Idempotent } from '@/shared/decorators/idempotent.decorator';

@Post()
@Idempotent()
async createOrder(@Body() dto: CreateOrderDto) {
  return this.ordersService.create(dto);
}
```

## Client usage

Clients send a unique key (typically a UUID v4) via the `Idempotency-Key` header:

```
POST /orders HTTP/1.1
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{ "item": "widget", "quantity": 1 }
```

If the request is retried with the same key, the server returns the original response with an `x-idempotent-replayed: true` header.

## Production considerations

The default implementation uses an in-memory `Map` for response caching. This is suitable for development and single-instance deployments but has limitations:

- Cache is lost on process restart
- Not shared across multiple instances
- No memory-pressure eviction

For production, replace the in-memory store with Redis or another distributed cache to ensure idempotency keys are shared across all application instances and survive restarts.

## References

- [IETF Draft: The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
