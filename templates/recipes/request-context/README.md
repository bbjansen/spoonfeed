# Request Context (CLS)

AsyncLocalStorage-based request context via nestjs-cls, providing correlation IDs, user info, and request metadata throughout the request lifecycle without explicit parameter passing.

## Links

- [nestjs-cls Documentation](https://papooch.github.io/nestjs-cls/)
- [nestjs-cls on npm](https://www.npmjs.com/package/nestjs-cls)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)

## Dependencies

| Package      | Version | Purpose                                     |
| ------------ | ------- | ------------------------------------------- |
| `nestjs-cls` | `4.5.0` | CLS (Continuation-Local Storage) for NestJS |

## Usage

Import `RequestContextModule` in your root module:

```typescript
import { RequestContextModule } from '@/shared/context/request-context.module';

@Module({
  imports: [RequestContextModule],
})
export class AppModule {}
```

Access context anywhere via `ClsService`:

```typescript
import { ClsService } from 'nestjs-cls';

@Injectable()
export class OrderService {
  constructor(private readonly cls: ClsService) {}

  createOrder(dto: CreateOrderDto) {
    const correlationId = this.cls.get('correlationId');
    const userId = this.cls.get('userId');
    // Use context without explicit parameter passing
  }
}
```

The middleware automatically sets:

- `correlationId` — from `x-correlation-id` header or a generated UUID
- `userId` — from `request.user.sub` (available after auth middleware)
- `ip` — client IP address

## Generated Files

| File                                           | Description                           |
| ---------------------------------------------- | ------------------------------------- |
| `src/shared/context/request-context.module.ts` | CLS module with middleware auto-setup |
