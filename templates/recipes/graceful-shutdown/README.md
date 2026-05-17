# Graceful Shutdown

Graceful application shutdown using NestJS lifecycle events.

## Links

- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [NestJS Application Shutdown](https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown)

## Dependencies

No additional dependencies required. Uses built-in NestJS lifecycle hooks.

| Package | Version | Purpose                          |
| ------- | ------- | -------------------------------- |
| (none)  | -       | Built-in NestJS lifecycle events |

## Usage

Enable shutdown hooks in `main.ts`:

```typescript
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

app.enableShutdownHooks();

await app.listen(3000, '0.0.0.0');
```

Implement lifecycle hooks in services that hold connections:

```typescript
import { Injectable, OnModuleDestroy, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class DatabaseService implements OnModuleDestroy, OnApplicationShutdown {
  async onModuleDestroy(): Promise<void> {
    // Stop accepting new work
    this.logger.log('Stopping database service...');
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    // Close connections
    this.logger.log(`Shutting down (signal: ${signal}), closing DB pool...`);
    await this.pool.end();
  }
}
```

## Generated Files

| File   | Description                                               |
| ------ | --------------------------------------------------------- |
| (none) | Applied directly in `main.ts` via `enableShutdownHooks()` |
