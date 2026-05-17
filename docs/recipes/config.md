# Configuration Recipes

Environment variable validation and per-environment configuration for NestJS applications.

## Available Recipes

| Recipe              | Approach                        | Best For                                       | Recipe README                                                                         |
| ------------------- | ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Config Validation   | Zod schema at startup           | Type-safe config, fast-fail on missing vars    | [config-validation](../../packages/templates/recipes/config-validation/README.md)     |
| Env per Environment | Separate `.env` files per stage | Dev/test/prod with different secrets and hosts | [env-per-environment](../../packages/templates/recipes/env-per-environment/README.md) |

## When to Use Each

- **Config Validation** — always. Validate all environment variables at boot so misconfigurations fail immediately instead of at runtime.
- **Env per Environment** — when your app runs in multiple stages (development, test, staging, production) and each needs different database URLs, API keys, or feature flags.

These two recipes complement each other: use env-per-environment to load the correct `.env` file, then validate its contents with a Zod schema.

## Comparison

| Feature           | Config Validation (Zod)         | Env per Environment          |
| ----------------- | ------------------------------- | ---------------------------- |
| Primary concern   | Correctness at startup          | File organisation per stage  |
| Type safety       | Full (Zod inference)            | None (raw strings)           |
| Default values    | Defined in schema               | Defined in `.env` files      |
| Secret management | Validates presence, not storage | `.env` files (gitignored)    |
| Fail-fast         | Yes — throws on boot            | No — missing vars fail later |

## Quick Start: Zod Config Validation

```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
});

export type EnvConfig = z.infer<typeof envSchema>;
```

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

## File Layout for Env per Environment

```
.env                  # shared defaults (committed)
.env.development      # local dev overrides (gitignored)
.env.test             # test overrides (gitignored)
.env.production       # production values (gitignored or from vault)
```

## External Documentation

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [@nestjs/config](https://www.npmjs.com/package/@nestjs/config)
- [Zod Documentation](https://zod.dev/)
- [dotenv](https://www.npmjs.com/package/dotenv)
