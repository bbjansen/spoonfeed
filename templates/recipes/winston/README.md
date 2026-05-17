# Winston Logger

Flexible logging using Winston for NestJS applications.

## Links

- [nest-winston on npm](https://www.npmjs.com/package/nest-winston)
- [nest-winston on GitHub](https://github.com/gremo/nest-winston)
- [Winston on GitHub](https://github.com/winstonjs/winston)
- [winston on npm](https://www.npmjs.com/package/winston)

## Dependencies

| Package        | Version  | Purpose                           |
| -------------- | -------- | --------------------------------- |
| `nest-winston` | `1.10.2` | NestJS Winston integration module |
| `winston`      | `3.17.0` | Versatile logging library         |

## Environment Variables

| Variable    | Default       | Description                                                                      |
| ----------- | ------------- | -------------------------------------------------------------------------------- |
| `LOG_LEVEL` | `info`        | Minimum log level (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`) |
| `NODE_ENV`  | `development` | Environment (controls log format)                                                |

## Usage

```typescript
import { LoggerModule } from '@/infrastructure/logging/logger.module';

@Module({
  imports: [LoggerModule],
})
export class AppModule {}

// In main.ts
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
```

## Generated Files

| File                                          | Description                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/infrastructure/logging/logger.module.ts` | WinstonModule configured with console transport and environment-aware formatting |
