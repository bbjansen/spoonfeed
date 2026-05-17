# Config Schema Validation

Validate environment variables at startup using Zod schemas, providing typed configuration access and fast failure on misconfiguration.

## Links

- [Zod Documentation](https://zod.dev/)
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)

## Dependencies

No additional dependencies required. Uses Zod, which is already available via the CLI.

## Usage

Pass `validateEnv` as the `validate` function in `ConfigModule.forRoot()`:

```typescript
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '@/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: validateEnv,
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

The application will fail to start if any required environment variable is missing or has an invalid value, with a clear error message listing all validation failures.

### Typed Config Access

Use the `EnvConfig` type for type-safe configuration access:

```typescript
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '@/config/env.validation';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  getPort(): number {
    return this.config.get('PORT');
  }
}
```

### Adding New Variables

Add new environment variables to the `envSchema` object in `src/config/env.validation.ts`. The schema supports defaults, coercion, and custom validation rules via Zod.

## Generated Files

| File                           | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `src/config/env.validation.ts` | Zod schema and validation function for env vars |
