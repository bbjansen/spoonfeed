# Scheduled Worker Project Type

## When to Use

Choose `scheduled-worker` when you need background jobs, periodic tasks, or queue-based processing. Common use cases: report generation, data synchronization, email digests, cleanup tasks, and event-driven batch processing.

## @nestjs/schedule Decorators

The `@nestjs/schedule` package provides three decorators for time-based task scheduling.

### @Cron

Run a task on a cron schedule.

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ReportScheduler {
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateDailyReport() {
    // Runs every day at 06:00
  }

  @Cron('0 */15 * * * *')
  async syncInventory() {
    // Runs every 15 minutes
  }

  @Cron('0 0 1 * *')
  async monthlyCleanup() {
    // Runs on the 1st of every month at midnight
  }
}
```

### @Interval

Run a task at a fixed interval (milliseconds).

```typescript
@Injectable()
export class HealthPoller {
  @Interval(30_000)
  async checkUpstreamHealth() {
    // Runs every 30 seconds
  }
}
```

### @Timeout

Run a task once after a delay (milliseconds).

```typescript
@Injectable()
export class StartupTask {
  @Timeout(5_000)
  async warmCache() {
    // Runs once, 5 seconds after application start
  }
}
```

### Registering the Module

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
})
export class AppModule {}
```

## BullMQ for Distributed Jobs

For jobs that require persistence, retries, concurrency control, or distribution across multiple workers, use BullMQ with Redis.

### Setup

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: 'email' }),
  ],
})
export class JobsModule {}
```

### Producer -- Adding Jobs to the Queue

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmailProducer {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendWelcome(userId: string) {
    await this.emailQueue.add(
      'welcome',
      { userId },
      {
        delay: 5_000, // Wait 5 seconds before processing
        attempts: 3, // Retry up to 3 times
        backoff: { type: 'exponential', delay: 1_000 },
      },
    );
  }

  async sendBulkDigest(userIds: string[]) {
    const jobs = userIds.map((userId) => ({
      name: 'digest',
      data: { userId },
      opts: { attempts: 3 },
    }));
    await this.emailQueue.addBulk(jobs);
  }
}
```

### Consumer -- Processing Jobs

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('email')
export class EmailConsumer extends WorkerHost {
  async process(job: Job<{ userId: string }>) {
    switch (job.name) {
      case 'welcome':
        await this.sendWelcomeEmail(job.data.userId);
        break;
      case 'digest':
        await this.sendDigestEmail(job.data.userId);
        break;
    }
  }

  private async sendWelcomeEmail(userId: string) {
    // Send welcome email
  }

  private async sendDigestEmail(userId: string) {
    // Send digest email
  }
}
```

## Job Retry and Failure Handling

### Retry Configuration

| Option             | Type    | Description                         |
| ------------------ | ------- | ----------------------------------- |
| `attempts`         | number  | Maximum retry attempts              |
| `backoff.type`     | string  | `fixed` or `exponential`            |
| `backoff.delay`    | number  | Base delay in milliseconds          |
| `removeOnComplete` | boolean | Remove job data after success       |
| `removeOnFail`     | boolean | Remove job data after final failure |

### Handling Failed Jobs

```typescript
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('email')
export class EmailConsumer extends WorkerHost {
  async process(job: Job) {
    // process job
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`);
    // Alert, log to dead-letter queue, etc.
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`Job ${job.id} completed`);
  }
}
```

## Monitoring Scheduled Jobs

### Health Check Endpoint

Expose a health endpoint that reports job queue status.

```typescript
import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('health')
export class HealthController {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  @Get('queues')
  async queueHealth() {
    const [waiting, active, failed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getFailedCount(),
    ]);

    return { email: { waiting, active, failed } };
  }
}
```

### Bull Board UI

Add [Bull Board](https://github.com/felixmosh/bull-board) for a web-based dashboard:

```typescript
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [BullBoardModule.forFeature({ name: 'email', adapter: BullMQAdapter })],
})
export class JobsModule {}
```

Access the dashboard at `/admin/queues` in development.
