# Add Message Consumer

Scaffold a new message consumer for event-driven or RPC-style messaging.

## Prompt

Ask the user for:

1. **Event or pattern name** (e.g. `order.created`, `user.sync`)
2. **Pattern type**: `@EventPattern` (fire-and-forget) or `@MessagePattern` (request-reply)
3. **Transport** if relevant (RabbitMQ, Kafka, Redis, NATS)

## Steps

1. **Create the handler** at `src/<domain>/<event-name>.handler.ts`:

   For event patterns (fire-and-forget):

   ```ts
   import { Controller } from '@nestjs/common';
   import { EventPattern, Payload } from '@nestjs/microservices';

   @Controller()
   export class OrderCreatedHandler {
     @EventPattern('order.created')
     async handle(@Payload() data: OrderCreatedEvent): Promise<void> {
       // process event
     }
   }
   ```

   For message patterns (request-reply):

   ```ts
   import { Controller } from '@nestjs/common';
   import { MessagePattern, Payload } from '@nestjs/microservices';

   @Controller()
   export class UserSyncHandler {
     @MessagePattern('user.sync')
     async handle(@Payload() data: UserSyncRequest): Promise<UserSyncResponse> {
       // process and return response
     }
   }
   ```

2. **Create the event/message DTO** at `src/<domain>/dto/<event-name>.event.ts`:
   - Use class-validator decorators for payload validation
   - Define both the event payload and response type (for MessagePattern)

3. **Register in module** — add the handler to the `controllers` array of the domain module

4. **Create test stub** at `tests/unit/<domain>/<event-name>.handler.spec.ts`:
   - Test payload processing logic
   - Test error handling paths
   - Mock only external dependencies (database, HTTP clients)

5. **Verify** — run `pnpm build` and `pnpm test`
