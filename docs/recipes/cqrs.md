# CQRS Recipes

Command Query Responsibility Segregation for NestJS. Separate read and write operations for scalable, event-driven architectures.

## Available Recipes

| Recipe | Description                                             | Recipe README                                           |
| ------ | ------------------------------------------------------- | ------------------------------------------------------- |
| CQRS   | Commands, queries, events, and sagas via `@nestjs/cqrs` | [cqrs](../../packages/templates/recipes/cqrs/README.md) |

## Concepts

| Concept             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| **Command**         | Encapsulates a write intent (e.g., `CreateOrderCommand`)   |
| **Command Handler** | Executes the command, performs side effects                |
| **Query**           | Encapsulates a read request (e.g., `GetOrderQuery`)        |
| **Query Handler**   | Reads data and returns a result                            |
| **Event**           | Something that happened (e.g., `OrderCreatedEvent`)        |
| **Event Handler**   | Reacts to events (send email, update cache, etc.)          |
| **Saga**            | Orchestrates long-running processes across multiple events |

## Quick Start

```typescript
// commands/create-order.command.ts
export class CreateOrderCommand {
  constructor(
    public readonly userId: string,
    public readonly items: OrderItem[],
  ) {}
}
```

```typescript
// commands/create-order.handler.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';

@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(
    private readonly repository: OrderRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrderCommand) {
    const order = await this.repository.create(command.userId, command.items);
    this.eventBus.publish(new OrderCreatedEvent(order.id, command.userId));
    return order;
  }
}
```

```typescript
// events/order-created.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  handle(event: OrderCreatedEvent) {
    // send confirmation email, update analytics, etc.
  }
}
```

```typescript
// queries/get-order.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery> {
  async execute(query: GetOrderQuery) {
    return this.readRepository.findById(query.orderId);
  }
}
```

## Module Setup

```typescript
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [CqrsModule],
  providers: [CreateOrderHandler, GetOrderHandler, OrderCreatedHandler],
})
export class OrdersModule {}
```

## When to Use CQRS

- Domains with complex business logic where reads and writes differ significantly
- Systems that benefit from event sourcing
- Microservice architectures with eventual consistency
- High-read, low-write workloads that benefit from separate read models

## External Documentation

- [NestJS CQRS Recipe](https://docs.nestjs.com/recipes/cqrs)
- [@nestjs/cqrs](https://www.npmjs.com/package/@nestjs/cqrs)
