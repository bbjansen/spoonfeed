# Redis Cache

Caching layer using cache-manager with Redis store for NestJS applications.

## Links

- [NestJS Caching Documentation](https://docs.nestjs.com/techniques/caching)
- [cache-manager on npm](https://www.npmjs.com/package/cache-manager)
- [cache-manager-redis-yet on npm](https://www.npmjs.com/package/cache-manager-redis-yet)
- [cache-manager-redis-yet on GitHub](https://github.com/node-cache-manager/node-cache-manager-redis-yet)
- [@nestjs/cache-manager on npm](https://www.npmjs.com/package/@nestjs/cache-manager)

## Dependencies

| Package                   | Version | Purpose                          |
| ------------------------- | ------- | -------------------------------- |
| `@nestjs/cache-manager`   | `2.3.0` | NestJS cache manager integration |
| `cache-manager`           | `5.7.6` | Flexible cache module            |
| `cache-manager-redis-yet` | `5.1.5` | Redis store for cache-manager    |

## Environment Variables

| Variable         | Default     | Description                  |
| ---------------- | ----------- | ---------------------------- |
| `REDIS_HOST`     | `localhost` | Redis server hostname        |
| `REDIS_PORT`     | `6379`      | Redis server port            |
| `REDIS_PASSWORD` | —           | Redis password (optional)    |
| `REDIS_TTL`      | `300`       | Default cache TTL in seconds |

## Usage

```typescript
import { CacheModule } from '@/infrastructure/cache/cache.module';

@Module({
  imports: [CacheModule],
})
export class AppModule {}

// Inject in a service
@Injectable()
export class UserService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getCachedUser(id: string) {
    return this.cacheManager.get(`user:${id}`);
  }
}
```

## Generated Files

| File                                       | Description                                               |
| ------------------------------------------ | --------------------------------------------------------- |
| `src/infrastructure/cache/cache.module.ts` | CacheModule configured with Redis store and ConfigService |
