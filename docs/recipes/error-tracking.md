# Error Tracking Recipes

Centralized error tracking and log aggregation for NestJS. Capture unhandled exceptions, track error frequency, and get alerted in real time.

## Available Recipes

| Recipe | Type                  | Best For                                                  | Recipe README                                               |
| ------ | --------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Sentry | Error tracking SaaS   | Crash reporting, performance monitoring, release tracking | [sentry](../../packages/templates/recipes/sentry/README.md) |
| Seq    | Structured log server | Self-hosted log aggregation, structured event search      | [seq2](../../packages/templates/recipes/seq2/README.md)     |

## Comparison

| Feature                | Sentry                             | Seq                          |
| ---------------------- | ---------------------------------- | ---------------------------- |
| Hosting                | SaaS or self-hosted                | Self-hosted                  |
| Primary focus          | Error/crash tracking               | Structured log search        |
| Alerting               | Built-in (email, Slack, PagerDuty) | Built-in (email, webhooks)   |
| Performance monitoring | Yes (tracing, spans)               | No                           |
| Release tracking       | Yes                                | No                           |
| Query language         | Tag-based search                   | Seq filter syntax (SQL-like) |
| Pricing                | Free tier + paid                   | Free (single user) + paid    |
| SDK                    | `@sentry/nestjs`                   | `seq-logging` / HTTP API     |

## When to Choose

- **Sentry**: You want turnkey error tracking with stack traces, breadcrumbs, user context, and release management. Best for teams that need actionable error reports.
- **Seq**: You want a self-hosted structured log server to search and correlate events across services. Pairs well with Pino or Winston.

## Quick Start: Sentry

```typescript
// main.ts
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

```typescript
// app.module.ts
import { SentryModule } from '@sentry/nestjs/setup';

@Module({
  imports: [SentryModule.forRoot()],
})
export class AppModule {}
```

## Quick Start: Seq

```typescript
import { Logger } from 'seq-logging';

const logger = new Logger({
  serverUrl: process.env.SEQ_URL,
  apiKey: process.env.SEQ_API_KEY,
  onError: (err) => console.error('Seq transport error:', err),
});

logger.emit({
  timestamp: new Date(),
  level: 'Error',
  messageTemplate: 'Order {orderId} failed: {error}',
  properties: { orderId: '123', error: 'Payment declined' },
});
```

## External Documentation

- [Sentry NestJS Guide](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [@sentry/nestjs](https://www.npmjs.com/package/@sentry/nestjs)
- [Seq Documentation](https://docs.datalust.co/docs)
- [seq-logging](https://www.npmjs.com/package/seq-logging)
