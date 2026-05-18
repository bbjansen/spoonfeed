# Queue & Messaging Recipes

spoonfeed provides 3 queue and messaging recipes covering message brokers, job queues, and dead letter handling. Use these recipes for asynchronous processing, event-driven architectures, and background job execution. Choose RabbitMQ for message routing and pub/sub, or BullMQ for Redis-backed job queues with scheduling and retries.

!!! tip "Recommended combinations"
    - **Reliable async processing:** `rabbitmq` + `dead-letter-queue` + `transactional-outbox`
    - **Background jobs with retries:** `bullmq` + `redis-cache` + `dead-letter-queue`

---

## RabbitMQ

RabbitMQ message broker integration via `@nestjs/microservices`.

| | |
| --- | --- |
| **ID** | `rabbitmq` |
| **Dependencies** | `@nestjs/microservices` `amqplib` |
| **Dev dependencies** | `@types/amqplib` |
| **Compatible with** | HTTP API, AWS Lambda, Microservice, Scheduled Worker, Monorepo, Full-Stack |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | RabbitMQ connection URL |

**Usage:**

- Use `@MessagePattern()` for request/response (RPC) patterns
- Use `@EventPattern()` for fire-and-forget event patterns
- Configure queues in the microservice module registration
- Use durable queues in production
- Define message contracts as typed interfaces
- Always acknowledge messages after successful processing

!!! warning "Requires a running RabbitMQ instance"
    RabbitMQ must be running locally or via Docker. The `docker-compose-dev` recipe can include a RabbitMQ service.

!!! tip
    Pair with the `dead-letter-queue` recipe for handling permanently failed messages.

**Pairs well with:** `dead-letter-queue`, `transactional-outbox`, `correlation-id`

---

## BullMQ

Redis-backed job queue with BullMQ for background job processing.

| | |
| --- | --- |
| **ID** | `bullmq` |
| **Dependencies** | `@nestjs/bullmq` `bullmq` |
| **Compatible with** | HTTP API, AWS Lambda, Microservice, Scheduled Worker, Monorepo, Full-Stack |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `REDIS_HOST` | `localhost` | Redis host for BullMQ |
| `REDIS_PORT` | `6379` | Redis port for BullMQ |

**Usage:**

- Define processors by extending `WorkerHost` with `@Processor()` decorator
- Inject `Queue` to add jobs: `queue.add('job-name', data)`
- Use named jobs for routing to specific handlers
- Handle failed jobs with `@OnWorkerEvent()` decorator
- Configure concurrency and rate limiting per queue

```typescript
@Processor('email')
export class EmailProcessor extends WorkerHost {
  async process(job: Job<EmailPayload>) {
    // Process the job
  }
}
```

!!! warning "Requires a running Redis instance"
    BullMQ uses Redis as its backing store. Ensure Redis is running locally or via Docker.

**Pairs well with:** `redis-cache`, `dead-letter-queue`

---

## Dead Letter Queue

Handle permanently failed messages with DLQ routing and replay.

| | |
| --- | --- |
| **ID** | `dead-letter-queue` |
| **Compatible with** | HTTP API, Microservice, Scheduled Worker, Monorepo, Full-Stack |

**Usage:**

- `DeadLetterQueueService` stores permanently failed messages
- Call `dlqService.add()` in queue error handlers when a message cannot be processed after retries
- Inspect dead letters with `getAll()` or `getByQueue()`
- Remove processed dead letters with `remove()`

Integrates with BullMQ or RabbitMQ by calling `dlqService.add()` in your consumer error handlers.

```typescript
try {
  await processMessage(message);
} catch (error) {
  if (retryCount >= maxRetries) {
    dlqService.add({
      queue: 'orders',
      payload: message,
      error: error.message,
      attempts: retryCount,
    });
  }
}
```
