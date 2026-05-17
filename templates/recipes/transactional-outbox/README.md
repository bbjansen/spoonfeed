# Transactional Outbox

Guarantee at-least-once event delivery alongside database writes using the transactional outbox pattern.

## Links

- [Microservices Pattern: Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Debezium — Change Data Capture](https://debezium.io/)
- [TypeORM Transactions](https://typeorm.io/transactions)

## Dependencies

No additional dependencies. Uses `typeorm` and `@nestjs/common` which are already included when using a TypeORM-based database recipe.

## How It Works

The transactional outbox pattern solves the dual-write problem: when you need to update a database **and** publish an event, doing both independently risks inconsistency (one succeeds, the other fails).

1. **Write phase** — Business data and outbox message are written in the same database transaction.
2. **Publish phase** — A separate polling publisher reads unpublished outbox rows and delivers them to the message broker.
3. **Mark phase** — After successful delivery, the row is marked as `published = true`.

This guarantees at-least-once delivery. Consumers must be idempotent.

## Usage

### Writing Events in a Transaction

```typescript
import { OutboxService } from '@/infrastructure/outbox/outbox.service';
import { DataSource } from 'typeorm';

@Injectable()
export class OrderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, dto);
      await manager.save(order);

      await this.outboxService.addMessage(manager, 'Order', order.id, 'OrderCreated', {
        orderId: order.id,
        total: order.total,
      });

      return order;
    });
  }
}
```

### Polling Publisher

A scheduled task reads unpublished messages and delivers them:

```typescript
@Injectable()
export class OutboxPublisher {
  constructor(
    private readonly dataSource: DataSource,
    private readonly messageBroker: MessageBroker,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPendingMessages(): Promise<void> {
    const messages = await this.dataSource
      .getRepository(OutboxMessage)
      .find({ where: { published: false }, order: { createdAt: 'ASC' }, take: 100 });

    for (const message of messages) {
      await this.messageBroker.publish(message.eventType, message.payload);
      await this.dataSource
        .getRepository(OutboxMessage)
        .update(message.id, { published: true, publishedAt: new Date() });
    }
  }
}
```

### CDC Alternative

For higher throughput, replace the polling publisher with Change Data Capture (CDC) using Debezium:

1. Debezium monitors the `outbox` table for new inserts.
2. New rows are automatically streamed to Kafka/RabbitMQ.
3. No polling needed — events are delivered in near real-time.
4. The application only writes to the outbox table; Debezium handles the rest.

## Generated Files

| File                                          | Description                               |
| --------------------------------------------- | ----------------------------------------- |
| `src/infrastructure/outbox/outbox.entity.ts`  | TypeORM entity for the outbox table       |
| `src/infrastructure/outbox/outbox.service.ts` | Service for adding messages to the outbox |
