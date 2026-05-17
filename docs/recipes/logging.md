# Logging Recipes

Structured logging for NestJS. Replace the default console logger with a production-grade logging library.

## Available Recipes

| Recipe  | Library      | Best For                             | Recipe README                                                 |
| ------- | ------------ | ------------------------------------ | ------------------------------------------------------------- |
| Pino    | nestjs-pino  | Performance-critical apps, JSON logs | [pino](../../packages/templates/recipes/pino/README.md)       |
| Winston | nest-winston | Flexible transports, custom formats  | [winston](../../packages/templates/recipes/winston/README.md) |

## Comparison

| Feature         | Pino                                      | Winston                                        |
| --------------- | ----------------------------------------- | ---------------------------------------------- |
| Performance     | Fastest (low overhead)                    | Good                                           |
| Output format   | JSON by default                           | Configurable (JSON, text, custom)              |
| Transports      | Separate process (pino-pretty, pino-file) | In-process (console, file, HTTP, etc.)         |
| Log levels      | trace, debug, info, warn, error, fatal    | silly, debug, verbose, info, warn, error       |
| Request context | Built-in via `nestjs-pino`                | Manual via `cls-hooked` or `AsyncLocalStorage` |
| Pretty printing | `pino-pretty` (dev only)                  | `winston.format.simple()`                      |
| Ecosystem       | Lean, focused                             | Large, many community transports               |

## When to Choose

- **Pino**: You need minimal latency overhead, structured JSON logs piped to a log aggregator (ELK, Datadog, CloudWatch). Recommended default.
- **Winston**: You need multiple simultaneous outputs (file + console + HTTP), custom formatting, or community transports (Slack, Sentry, etc.).

## Quick Start: Pino

```typescript
// app.module.ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
  ],
})
export class AppModule {}
```

```typescript
// main.ts
import { Logger } from 'nestjs-pino';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

## Quick Start: Winston

```typescript
// app.module.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRoot({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      ],
    }),
  ],
})
export class AppModule {}
```

## External Documentation

- [nestjs-pino](https://www.npmjs.com/package/nestjs-pino)
- [nest-winston](https://www.npmjs.com/package/nest-winston)
- [Pino Documentation](https://getpino.io)
- [Winston Documentation](https://github.com/winstonjs/winston)
