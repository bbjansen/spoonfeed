# Request Context Recipes

AsyncLocalStorage-based request context propagation for NestJS, enabling access to request-scoped data (correlation IDs, user info) anywhere in the call stack without passing parameters.

## Available Recipes

| Recipe          | Library / Approach                     | Best For                               | Recipe README                                                                 |
| --------------- | -------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Request Context | nestjs-cls (AsyncLocalStorage)         | User context, tenant ID, feature flags | [request-context](../../packages/templates/recipes/request-context/README.md) |
| Correlation ID  | AsyncLocalStorage + header propagation | Distributed tracing, log correlation   | [correlation-id](../../packages/templates/recipes/correlation-id/README.md)   |

## When to Use Each

- **Request Context** — when services deep in the call stack need request-scoped data (current user, tenant, locale) without threading it through every method signature.
- **Correlation ID** — when you need a unique ID per request that appears in logs and propagates to downstream HTTP calls, making it easy to trace a request across microservices.

Both recipes use `AsyncLocalStorage` under the hood. They can be combined: use nestjs-cls as the store and register the correlation ID as one of its values.

## Comparison

| Feature                | Request Context (CLS)  | Correlation ID                  |
| ---------------------- | ---------------------- | ------------------------------- |
| Scope                  | Full request lifecycle | Full request lifecycle          |
| Primary data           | User, tenant, metadata | Unique trace ID                 |
| Downstream propagation | Optional               | Yes (outgoing HTTP headers)     |
| Log integration        | Via CLS store access   | Injected into logger context    |
| Library                | nestjs-cls             | Custom middleware or nestjs-cls |

## Quick Start: Request Context with nestjs-cls

```typescript
import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { v4 as uuid } from 'uuid';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req) => {
          cls.set('requestId', req.headers['x-request-id'] ?? uuid());
          cls.set('userId', req.user?.id);
        },
      },
    }),
  ],
})
export class AppModule {}
```

Access the store anywhere:

```typescript
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class OrderService {
  constructor(private readonly cls: ClsService) {}

  createOrder(dto: CreateOrderDto) {
    const userId = this.cls.get('userId');
    const requestId = this.cls.get('requestId');
    // userId and requestId available without method parameters
  }
}
```

## External Documentation

- [nestjs-cls Documentation](https://papooch.github.io/nestjs-cls/)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [NestJS Request Scoping](https://docs.nestjs.com/fundamentals/injection-scopes)
