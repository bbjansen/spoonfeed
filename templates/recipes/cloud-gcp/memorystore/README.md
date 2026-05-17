# GCP Memorystore

Google Cloud Memorystore (Redis) managed caching service integration for NestJS.

## Documentation

- [GCP Memorystore for Redis Documentation](https://cloud.google.com/memorystore/docs/redis)
- [ioredis on npm](https://www.npmjs.com/package/ioredis)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)

## Dependencies

| Package   | Version | Purpose                  |
| --------- | ------- | ------------------------ |
| `ioredis` | `5.4.2` | Redis client for Node.js |

## Environment Variables

| Variable           | Default | Description            |
| ------------------ | ------- | ---------------------- |
| `MEMORYSTORE_HOST` | —       | Memorystore Redis host |
| `MEMORYSTORE_PORT` | `6379`  | Memorystore Redis port |

## Usage

```typescript
import Redis from 'ioredis';

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.getOrThrow('MEMORYSTORE_HOST'),
          port: config.get<number>('MEMORYSTORE_PORT', 6379),
        }),
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
```
