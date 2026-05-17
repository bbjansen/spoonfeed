# Pino Logger

Structured JSON logging using Pino for NestJS applications.

## Links

- [nestjs-pino on npm](https://www.npmjs.com/package/nestjs-pino)
- [nestjs-pino on GitHub](https://github.com/iamolegga/nestjs-pino)
- [Pino Documentation](https://getpino.io)
- [pino on npm](https://www.npmjs.com/package/pino)
- [pino-pretty on npm](https://www.npmjs.com/package/pino-pretty)

## Dependencies

| Package       | Version  | Purpose                               |
| ------------- | -------- | ------------------------------------- |
| `nestjs-pino` | `4.2.0`  | NestJS Pino integration module        |
| `pino`        | `9.6.0`  | Fast JSON logger                      |
| `pino-pretty` | `13.0.0` | Pretty-print Pino logs in development |
| `pino-http`   | `10.4.0` | HTTP request logging for Pino         |

## Environment Variables

| Variable    | Default       | Description                                                            |
| ----------- | ------------- | ---------------------------------------------------------------------- |
| `LOG_LEVEL` | `info`        | Minimum log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `NODE_ENV`  | `development` | Environment (controls pretty-printing)                                 |

## Usage

```typescript
import { LoggerModule } from '@/infrastructure/logging/logger.module';

@Module({
  imports: [LoggerModule],
})
export class AppModule {}

// In main.ts
import { Logger } from 'nestjs-pino';
app.useLogger(app.get(Logger));
```

## Generated Files

| File                                          | Description                                                        |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `src/infrastructure/logging/logger.module.ts` | LoggerModule configured with Pino and environment-aware formatting |
