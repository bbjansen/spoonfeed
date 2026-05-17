# Request Logging

HTTP request/response logging middleware with timing, status codes, and structured output.

## Links

- [NestJS Middleware](https://docs.nestjs.com/middleware)
- [NestJS Logger](https://docs.nestjs.com/techniques/logger)

## Dependencies

No additional dependencies required. Uses the built-in NestJS logger.

| Package | Version | Purpose                  |
| ------- | ------- | ------------------------ |
| (none)  | -       | Built-in NestJS `Logger` |

## Usage

Register middleware in your module:

```typescript
import { RequestLoggingMiddleware } from '@/shared/middleware/request-logging.middleware';

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
```

## Generated Files

| File                                                  | Description                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/shared/middleware/request-logging.middleware.ts` | Middleware that logs incoming requests and outgoing responses with timing |
