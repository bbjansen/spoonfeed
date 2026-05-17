# HTTP Cache Headers

RFC 9111 `Cache-Control` and conditional request headers for NestJS endpoints.

## References

- [RFC 9111 — HTTP Caching](https://datatracker.ietf.org/doc/html/rfc9111)
- [MDN — Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)

## Installation

Register `CacheControlInterceptor` globally in your app module or apply it per controller.

```typescript
import { CacheControlInterceptor } from '@/shared/interceptors/cache-control.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheControlInterceptor,
    },
  ],
})
export class AppModule {}
```

## Usage

Apply the `@CacheControl()` decorator to GET endpoints:

```typescript
import { CacheControl } from '@/shared/decorators/cache-control.decorator';

@Controller('products')
export class ProductsController {
  @Get()
  @CacheControl({ public: true, maxAge: 3600, staleWhileRevalidate: 86400 })
  findAll() {
    // Response includes: Cache-Control: public, max-age=3600, stale-while-revalidate=86400
  }

  @Get('profile')
  @CacheControl({ private: true, noCache: true })
  getProfile() {
    // Response includes: Cache-Control: private, no-cache
  }
}
```

## Supported Directives

| Option                 | Header Directive                   |
| ---------------------- | ---------------------------------- |
| `public`               | `public`                           |
| `private`              | `private`                          |
| `noCache`              | `no-cache`                         |
| `noStore`              | `no-store`                         |
| `mustRevalidate`       | `must-revalidate`                  |
| `maxAge`               | `max-age=<seconds>`                |
| `sMaxAge`              | `s-maxage=<seconds>`               |
| `staleWhileRevalidate` | `stale-while-revalidate=<seconds>` |
| `staleIfError`         | `stale-if-error=<seconds>`         |
