# RabbitMQ

Message queue integration using RabbitMQ for NestJS microservices.

## Links

- [NestJS RabbitMQ Documentation](https://docs.nestjs.com/microservices/rabbitmq)
- [@nestjs/microservices on npm](https://www.npmjs.com/package/@nestjs/microservices)
- [amqplib on npm](https://www.npmjs.com/package/amqplib)
- [amqplib on GitHub](https://github.com/amqp-node/amqplib)
- [amqp-connection-manager on npm](https://www.npmjs.com/package/amqp-connection-manager)

## Dependencies

| Package                   | Version   | Purpose                           |
| ------------------------- | --------- | --------------------------------- |
| `@nestjs/microservices`   | `10.4.15` | NestJS microservices module       |
| `amqplib`                 | `0.10.5`  | AMQP 0-9-1 client for RabbitMQ    |
| `amqp-connection-manager` | `4.1.14`  | Connection management for amqplib |

## Environment Variables

| Variable         | Default                 | Description             |
| ---------------- | ----------------------- | ----------------------- |
| `RABBITMQ_URL`   | `amqp://localhost:5672` | RabbitMQ connection URL |
| `RABBITMQ_QUEUE` | —                       | Default queue name      |

## Usage

```typescript
import { QueueModule } from '@/infrastructure/queue/queue.module';

@Module({
  imports: [QueueModule],
})
export class AppModule {}

// Send a message
@Injectable()
export class NotificationSender {
  constructor(@Inject('RABBITMQ_CLIENT') private client: ClientProxy) {}

  async sendNotification(data: any) {
    return this.client.emit('notification.send', data);
  }
}
```

## Generated Files

| File                                       | Description                                                |
| ------------------------------------------ | ---------------------------------------------------------- |
| `src/infrastructure/queue/queue.module.ts` | RabbitMQ client module with ConfigService-based connection |
