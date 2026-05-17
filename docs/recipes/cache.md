# Cache Recipes

Redis-based caching for NestJS applications. Reduce database load and improve response times with in-memory caching.

## Available Recipes

| Recipe      | Description                                    | Recipe README                                                         |
| ----------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Redis Cache | Cache manager backed by Redis with TTL support | [redis-cache](../../packages/templates/recipes/redis-cache/README.md) |

## Usage Patterns

### Cache Interceptor (Declarative)

Apply caching at the controller or route level using the built-in interceptor.

```typescript
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL, CacheKey } from '@nestjs/cache-manager';

@Controller('products')
@UseInterceptors(CacheInterceptor)
export class ProductsController {
  @Get()
  @CacheTTL(30) // seconds
  @CacheKey('all-products')
  findAll() {
    return this.productsService.findAll();
  }
}
```

### Manual Cache Manager (Programmatic)

Inject the cache manager for fine-grained control.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ProductsService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async findOne(id: string) {
    const cached = await this.cache.get<Product>(`product:${id}`);
    if (cached) return cached;

    const product = await this.repository.findOne(id);
    await this.cache.set(`product:${id}`, product, 60);
    return product;
  }

  async invalidate(id: string) {
    await this.cache.del(`product:${id}`);
  }
}
```

### Cache-Aside Pattern

Best practice for most use cases: check cache first, fall back to source, then populate cache.

```typescript
async getOrSet<T>(key: string, factory: () => Promise<T>, ttl = 300): Promise<T> {
  const cached = await this.cache.get<T>(key);
  if (cached !== undefined) return cached;

  const value = await factory();
  await this.cache.set(key, value, ttl);
  return value;
}
```

## Configuration

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: () => ({
        store: redisStore,
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
        ttl: 300, // default TTL in seconds
      }),
    }),
  ],
})
export class AppModule {}
```

## External Documentation

- [NestJS Caching](https://docs.nestjs.com/techniques/caching)
- [cache-manager](https://www.npmjs.com/package/cache-manager)
- [cache-manager-redis-yet](https://www.npmjs.com/package/cache-manager-redis-yet)
- [Redis Documentation](https://redis.io/docs)
