# Multi-Tenancy

Request-scoped tenant context using AsyncLocalStorage with middleware and decorator.

## Links

- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [NestJS Middleware](https://docs.nestjs.com/middleware)
- [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators)

## Dependencies

No additional dependencies required. Uses the built-in `node:async_hooks` module.

| Package | Version | Purpose                     |
| ------- | ------- | --------------------------- |
| (none)  | -       | Built-in `node:async_hooks` |

## Usage

Register middleware in your module:

```typescript
import { TenantMiddleware } from '@/shared/middleware/tenant.middleware';

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
```

Access the tenant in controllers:

```typescript
import { CurrentTenant } from '@/shared/decorators/tenant.decorator';

@Get('data')
getData(@CurrentTenant() tenantId: string) {
  return this.service.findByTenant(tenantId);
}
```

## Generated Files

| File                                         | Description                                     |
| -------------------------------------------- | ----------------------------------------------- |
| `src/shared/middleware/tenant.middleware.ts` | Tenant context middleware via AsyncLocalStorage |
| `src/shared/decorators/tenant.decorator.ts`  | `@CurrentTenant()` parameter decorator          |
