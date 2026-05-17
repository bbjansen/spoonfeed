# Throttler (Rate Limiting)

Rate limiting for NestJS using the official throttler module.

## Links

- [NestJS Rate Limiting](https://docs.nestjs.com/security/rate-limiting)
- [@nestjs/throttler on npm](https://www.npmjs.com/package/@nestjs/throttler)
- [@nestjs/throttler on GitHub](https://github.com/nestjs/throttler)

## Dependencies

| Package             | Version | Purpose                        |
| ------------------- | ------- | ------------------------------ |
| `@nestjs/throttler` | `6.3.0` | Rate limiting guard and module |

## Usage

```typescript
import { throttlerConfig } from '@/shared/guards/throttle.config';

@Module({
  imports: [ThrottlerModule.forRoot(throttlerConfig)],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

Skip throttling on specific routes:

```typescript
@SkipThrottle()
@Get('health')
healthCheck() { return { ok: true }; }
```

## Generated Files

| File                                   | Description                                                   |
| -------------------------------------- | ------------------------------------------------------------- |
| `src/shared/guards/throttle.config.ts` | Throttler module configuration with multiple rate limit tiers |
