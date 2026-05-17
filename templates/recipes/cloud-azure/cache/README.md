# Azure Cache for Redis

Azure Cache for Redis managed caching service integration for NestJS.

## Documentation

- [Azure Cache for Redis Documentation](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/)
- [ioredis on npm](https://www.npmjs.com/package/ioredis)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)

## Dependencies

| Package   | Version | Purpose                  |
| --------- | ------- | ------------------------ |
| `ioredis` | `5.4.2` | Redis client for Node.js |

## Environment Variables

| Variable               | Default | Description                      |
| ---------------------- | ------- | -------------------------------- |
| `AZURE_REDIS_HOST`     | —       | Azure Cache for Redis hostname   |
| `AZURE_REDIS_PORT`     | `6380`  | Azure Cache for Redis port (TLS) |
| `AZURE_REDIS_PASSWORD` | —       | Azure Cache for Redis access key |

## Usage

```typescript
import Redis from 'ioredis';

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.getOrThrow('AZURE_REDIS_HOST'),
          port: config.get<number>('AZURE_REDIS_PORT', 6380),
          password: config.get('AZURE_REDIS_PASSWORD'),
          tls: { servername: config.getOrThrow('AZURE_REDIS_HOST') },
        }),
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
```
