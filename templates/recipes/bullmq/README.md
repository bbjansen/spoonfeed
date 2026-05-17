# BullMQ

Background job processing using BullMQ with Redis for NestJS applications.

## Links

- [NestJS Queues Documentation](https://docs.nestjs.com/techniques/queues)
- [BullMQ Documentation](https://docs.bullmq.io)
- [@nestjs/bullmq on npm](https://www.npmjs.com/package/@nestjs/bullmq)
- [bullmq on npm](https://www.npmjs.com/package/bullmq)
- [BullMQ on GitHub](https://github.com/taskforcesh/bullmq)

## Dependencies

| Package          | Version  | Purpose                              |
| ---------------- | -------- | ------------------------------------ |
| `@nestjs/bullmq` | `10.2.3` | NestJS BullMQ integration module     |
| `bullmq`         | `5.34.8` | Modern Redis-based queue for Node.js |

## Environment Variables

| Variable         | Default     | Description               |
| ---------------- | ----------- | ------------------------- |
| `REDIS_HOST`     | `localhost` | Redis server hostname     |
| `REDIS_PORT`     | `6379`      | Redis server port         |
| `REDIS_PASSWORD` | —           | Redis password (optional) |

## Usage

```typescript
import { QueueModule } from '@/infrastructure/queue/queue.module';

@Module({
  imports: [QueueModule],
})
export class AppModule {}

// Add a job to the queue
@Injectable()
export class EmailSender {
  constructor(@InjectQueue('example') private exampleQueue: Queue) {}

  async sendWelcomeEmail(userId: string) {
    await this.exampleQueue.add('send-welcome', { userId });
  }
}
```

## Generated Files

| File                                            | Description                                                |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `src/infrastructure/queue/queue.module.ts`      | BullMQ module with Redis connection configuration          |
| `src/infrastructure/queue/example.processor.ts` | Example job processor demonstrating the @Processor pattern |
