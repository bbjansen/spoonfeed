# Sentry

Error tracking and performance monitoring for NestJS with the official Sentry SDK.

## Links

- [Sentry NestJS Guide](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [@sentry/nestjs on npm](https://www.npmjs.com/package/@sentry/nestjs)
- [@sentry/nestjs on GitHub](https://github.com/getsentry/sentry-javascript)

## Dependencies

| Package          | Version  | Purpose                           |
| ---------------- | -------- | --------------------------------- |
| `@sentry/nestjs` | `9.26.0` | Sentry SDK for NestJS integration |

## Environment Variables

| Variable                    | Description                         | Example                                          |
| --------------------------- | ----------------------------------- | ------------------------------------------------ |
| `SENTRY_DSN`                | Sentry project DSN                  | `https://examplePublicKey@o0.ingest.sentry.io/0` |
| `SENTRY_ENVIRONMENT`        | Deployment environment name         | `production`                                     |
| `SENTRY_TRACES_SAMPLE_RATE` | Performance sampling rate (0.0–1.0) | `0.2`                                            |

## Usage

```typescript
import { SentryModule } from '@/infrastructure/sentry/sentry.module';

@Module({
  imports: [SentryModule],
})
export class AppModule {}
```

Register the global exception filter in `main.ts`:

```typescript
import { SentryExceptionFilter } from '@/infrastructure/sentry/sentry.filter';

app.useGlobalFilters(new SentryExceptionFilter());
```

## Generated Files

| File                                         | Description                                    |
| -------------------------------------------- | ---------------------------------------------- |
| `src/infrastructure/sentry/sentry.module.ts` | Sentry module with SDK initialisation          |
| `src/infrastructure/sentry/sentry.filter.ts` | Global exception filter that reports to Sentry |
