# Per-Environment Configuration

Environment-specific `.env` files for development, test, and production.

## Links

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [dotenv on npm](https://www.npmjs.com/package/dotenv)

## Dependencies

| Package          | Version | Purpose                          |
| ---------------- | ------- | -------------------------------- |
| `@nestjs/config` | `4.0.2` | Environment configuration module |

## Usage

Load the correct env file based on `NODE_ENV` in your `AppModule`:

```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

## Generated Files

| File               | Description                         |
| ------------------ | ----------------------------------- |
| `.env.development` | Development environment defaults    |
| `.env.test`        | Test environment defaults           |
| `.env.production`  | Production environment placeholders |
