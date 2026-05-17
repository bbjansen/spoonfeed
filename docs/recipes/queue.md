# Queue Recipes

Message queue and job processing options for NestJS. Use queues for background jobs, async processing, and service-to-service communication.

## Available Recipes

| Recipe   | Transport  | Best For                                       | Recipe README                                                   |
| -------- | ---------- | ---------------------------------------------- | --------------------------------------------------------------- |
| RabbitMQ | AMQP 0-9-1 | Service-to-service messaging, pub/sub, routing | [rabbitmq](../../packages/templates/recipes/rabbitmq/README.md) |
| BullMQ   | Redis      | Background jobs, delayed tasks, rate limiting  | [bullmq](../../packages/templates/recipes/bullmq/README.md)     |

## Comparison

| Feature       | RabbitMQ                    | BullMQ                    |
| ------------- | --------------------------- | ------------------------- |
| Broker        | RabbitMQ server (Erlang)    | Redis                     |
| Protocol      | AMQP                        | Redis commands            |
| Use case      | Microservice communication  | Background job processing |
| Routing       | Exchanges, queues, bindings | Named queues              |
| Delayed jobs  | Via plugin                  | Built-in                  |
| Rate limiting | Manual                      | Built-in                  |
| Retry         | Dead-letter exchanges       | Built-in with backoff     |
| UI dashboard  | RabbitMQ Management         | Bull Board / Arena        |
| Persistence   | Disk-backed queues          | Redis persistence         |
| Scalability   | Clustering, federation      | Redis Cluster             |

## Quick Start: BullMQ

```typescript
// app.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
      },
    }),
    BullModule.registerQueue({ name: 'email' }),
  ],
})
export class AppModule {}
```

```typescript
// email.producer.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmailProducer {
  constructor(@InjectQueue('email') private queue: Queue) {}

  async sendWelcome(userId: string) {
    await this.queue.add('welcome', { userId }, { delay: 5000 });
  }
}
```

```typescript
// email.consumer.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('email')
export class EmailConsumer extends WorkerHost {
  async process(job: Job) {
    switch (job.name) {
      case 'welcome':
        await this.sendWelcomeEmail(job.data.userId);
        break;
    }
  }
}
```

## Quick Start: RabbitMQ

```typescript
// app.module.ts
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDERS_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: 'orders_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
})
export class AppModule {}
```

## External Documentation

- [NestJS RabbitMQ Microservice](https://docs.nestjs.com/microservices/rabbitmq)
- [NestJS Queues (BullMQ)](https://docs.nestjs.com/techniques/queues)
- [BullMQ Documentation](https://docs.bullmq.io)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html)
