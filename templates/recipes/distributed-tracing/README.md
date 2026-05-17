# Distributed Tracing (W3C Trace Context)

W3C Trace Context header propagation for services not using full OpenTelemetry auto-instrumentation.

## Links

- [W3C Trace Context Specification](https://www.w3.org/TR/trace-context/)
- [NestJS Middleware](https://docs.nestjs.com/middleware)

## Dependencies

No additional dependencies required. Implements the W3C specification directly.

| Package | Version | Purpose                                          |
| ------- | ------- | ------------------------------------------------ |
| (none)  | -       | W3C trace context header parsing and propagation |

## Usage

Register middleware in your module:

```typescript
import { TracePropagationMiddleware } from '@/shared/middleware/trace-propagation.middleware';

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TracePropagationMiddleware).forRoutes('*');
  }
}
```

Access trace context:

```typescript
import { traceStorage } from '@/shared/middleware/trace-propagation.middleware';

const ctx = traceStorage.getStore();
// ctx?.traceId, ctx?.spanId, ctx?.traceFlags
```

## Generated Files

| File                                                    | Description                                     |
| ------------------------------------------------------- | ----------------------------------------------- |
| `src/shared/middleware/trace-propagation.middleware.ts` | W3C trace context header propagation middleware |
