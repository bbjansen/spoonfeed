# Correlation ID

Request correlation using AsyncLocalStorage for distributed tracing across services.

## Links

- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [NestJS Middleware](https://docs.nestjs.com/middleware)

## Dependencies

No additional dependencies required. Uses the built-in `node:async_hooks` module.

| Package | Version | Purpose                     |
| ------- | ------- | --------------------------- |
| (none)  | -       | Built-in `node:async_hooks` |

## Usage

Register middleware in your module:

```typescript
import { CorrelationIdMiddleware } from '@/shared/middleware/correlation-id.middleware';

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

Access the correlation ID anywhere in the call chain:

```typescript
import { correlationStorage } from '@/shared/middleware/correlation-id.middleware';

const correlationId = correlationStorage.getStore();
```

## Generated Files

| File                                                 | Description                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/shared/middleware/correlation-id.middleware.ts` | Middleware that extracts or generates a correlation ID and stores it in AsyncLocalStorage |
