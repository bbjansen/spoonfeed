# Audit Trail

Record entity changes with user, action, and diff for compliance and debugging.

## Links

- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [TypeORM Subscribers](https://typeorm.io/listeners-and-subscribers#what-is-a-subscriber)

## Dependencies

None — uses NestJS interceptors and decorators.

## Usage

### Interceptor Approach

Apply `AuditInterceptor` globally or per-controller to log mutating requests:

```typescript
import { AuditInterceptor } from '@/shared/interceptors/audit.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
```

Or apply per-controller:

```typescript
@UseInterceptors(AuditInterceptor)
@Controller('users')
export class UsersController {}
```

Use the `@Auditable()` decorator to mark controllers or handlers for selective auditing:

```typescript
@Auditable()
@Controller('orders')
export class OrdersController {}
```

### TypeORM Subscriber Approach

For entity-level auditing, use a TypeORM subscriber:

```typescript
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  afterUpdate(event: UpdateEvent<any>): void {
    // Log old vs new values from event.databaseEntity and event.entity
  }
}
```

### Compliance Use Cases

- **GDPR**: Track who accessed or modified personal data
- **SOC 2**: Maintain change logs for audit controls
- **HIPAA**: Record access to protected health information
- **Financial**: Immutable trail for transaction modifications

## Generated Files

| File                                           | Description                                             |
| ---------------------------------------------- | ------------------------------------------------------- |
| `src/shared/interceptors/audit.interceptor.ts` | Interceptor that records mutating request audit entries |
| `src/shared/decorators/auditable.decorator.ts` | Metadata decorator to mark auditable controllers        |
