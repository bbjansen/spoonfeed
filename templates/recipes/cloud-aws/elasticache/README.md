# AWS ElastiCache

AWS ElastiCache (Redis) managed caching service integration for NestJS.

## Documentation

- [AWS ElastiCache for Redis User Guide](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/)
- [ioredis on npm](https://www.npmjs.com/package/ioredis)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)

## Dependencies

| Package   | Version | Purpose                  |
| --------- | ------- | ------------------------ |
| `ioredis` | `5.4.2` | Redis client for Node.js |

## Environment Variables

| Variable               | Default | Description                  |
| ---------------------- | ------- | ---------------------------- |
| `ELASTICACHE_ENDPOINT` | —       | ElastiCache primary endpoint |
| `ELASTICACHE_PORT`     | `6379`  | ElastiCache port             |

## Usage

```typescript
import Redis from 'ioredis';

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.getOrThrow('ELASTICACHE_ENDPOINT'),
          port: config.get<number>('ELASTICACHE_PORT', 6379),
          tls: {},
        }),
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
```
