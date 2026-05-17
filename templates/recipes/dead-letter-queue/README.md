# Dead Letter Queue

Handle permanently failed messages with DLQ routing, inspection, and replay.

## Links

- [BullMQ Dead Letter Queue](https://docs.bullmq.io/)
- [RabbitMQ Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx)

## Dependencies

No additional dependencies required.

## Usage

Inject `DeadLetterQueueService` in your queue consumers and route permanently failed messages to the DLQ:

```typescript
import { DeadLetterQueueService } from '@/infrastructure/queue/dlq.service';

@Injectable()
export class OrderConsumer {
  constructor(private readonly dlq: DeadLetterQueueService) {}

  async handleMessage(message: unknown): Promise<void> {
    try {
      await this.process(message);
    } catch (error) {
      this.dlq.add({
        queue: 'orders',
        payload: message,
        error: error instanceof Error ? error.message : String(error),
        attempts: 3,
      });
    }
  }
}
```

### BullMQ Integration

Configure BullMQ to route failed jobs after max attempts:

```typescript
@Processor('orders')
export class OrderProcessor {
  constructor(private readonly dlq: DeadLetterQueueService) {}

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    if (job.attemptsMade >= job.opts.attempts) {
      this.dlq.add({
        queue: 'orders',
        payload: job.data,
        error: error.message,
        attempts: job.attemptsMade,
      });
    }
  }
}
```

### RabbitMQ Integration

For RabbitMQ, configure dead letter exchanges at the queue level and use the service to track and inspect failed messages in your application.

### Inspecting Dead Letters

```typescript
const allMessages = dlqService.getAll();
const orderFailures = dlqService.getByQueue('orders');
dlqService.remove(messageId);
```

## Generated Files

| File                                      | Description               |
| ----------------------------------------- | ------------------------- |
| `src/infrastructure/queue/dlq.service.ts` | Dead letter queue service |
