# TypeORM MySQL

Database integration using TypeORM with MySQL driver for NestJS applications.

## Links

- [NestJS Database Documentation](https://docs.nestjs.com/techniques/database)
- [@nestjs/typeorm on npm](https://www.npmjs.com/package/@nestjs/typeorm)
- [TypeORM Documentation](https://typeorm.io)
- [TypeORM on GitHub](https://github.com/typeorm/typeorm)
- [mysql2 on npm](https://www.npmjs.com/package/mysql2)

## Dependencies

| Package           | Version  | Purpose                           |
| ----------------- | -------- | --------------------------------- |
| `@nestjs/typeorm` | `10.0.2` | NestJS TypeORM integration module |
| `typeorm`         | `0.3.20` | TypeScript ORM for SQL databases  |
| `mysql2`          | `3.11.5` | MySQL client for Node.js          |

## Environment Variables

| Variable         | Default     | Description                              |
| ---------------- | ----------- | ---------------------------------------- |
| `DB_HOST`        | `localhost` | MySQL server hostname                    |
| `DB_PORT`        | `3306`      | MySQL server port                        |
| `DB_USERNAME`    | `root`      | Database user                            |
| `DB_PASSWORD`    | —           | Database password                        |
| `DB_NAME`        | —           | Database name                            |
| `DB_SYNCHRONIZE` | `false`     | Auto-sync schema (disable in production) |
| `DB_LOGGING`     | `false`     | Enable SQL query logging                 |

## Usage

```typescript
import { DatabaseModule } from '@/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
})
export class AppModule {}
```

## Generated Files

| File                                             | Description                                            |
| ------------------------------------------------ | ------------------------------------------------------ |
| `src/infrastructure/database/database.module.ts` | TypeORM module configured with MySQL and ConfigService |
