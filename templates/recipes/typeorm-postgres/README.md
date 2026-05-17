# TypeORM PostgreSQL

Database integration using TypeORM with PostgreSQL driver for NestJS applications.

## Links

- [NestJS Database Documentation](https://docs.nestjs.com/techniques/database)
- [@nestjs/typeorm on npm](https://www.npmjs.com/package/@nestjs/typeorm)
- [TypeORM Documentation](https://typeorm.io)
- [TypeORM on GitHub](https://github.com/typeorm/typeorm)
- [pg on npm](https://www.npmjs.com/package/pg)

## Dependencies

| Package           | Version  | Purpose                           |
| ----------------- | -------- | --------------------------------- |
| `@nestjs/typeorm` | `10.0.2` | NestJS TypeORM integration module |
| `typeorm`         | `0.3.20` | TypeScript ORM for SQL databases  |
| `pg`              | `8.13.1` | PostgreSQL client for Node.js     |

## Environment Variables

| Variable         | Default     | Description                              |
| ---------------- | ----------- | ---------------------------------------- |
| `DB_HOST`        | `localhost` | PostgreSQL server hostname               |
| `DB_PORT`        | `5432`      | PostgreSQL server port                   |
| `DB_USERNAME`    | `postgres`  | Database user                            |
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

| File                                              | Description                                                 |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `src/infrastructure/database/database.module.ts`  | TypeORM module configured with PostgreSQL and ConfigService |
| `src/infrastructure/database/entities/`           | Directory for TypeORM entity definitions                    |
| `src/infrastructure/database/migrations/`         | Directory for database migration files                      |
| `src/infrastructure/database/migrations/index.ts` | Barrel file for explicit migration imports (Lambda compat)  |
| `src/infrastructure/database/entities/index.ts`   | Barrel file for entity class exports                        |
| `src/infrastructure/database/data-source.ts`      | CLI data source for local migration commands                |
| `src/lambdas/migration-runner/index.ts`           | Lambda handler for serverless migration execution           |

## Migration Workflow

### Local Development

```bash
# Generate migration from entity changes
pnpm migration:generate src/infrastructure/database/migrations/MigrationName

# Run pending migrations
pnpm migration:run

# Revert last migration
pnpm migration:revert
```

### Serverless (AWS Lambda)

For serverless deployments, use the migration-runner Lambda pattern. See [Serverless Migrations Standard](../../../docs/standards/serverless-migrations.md).

The migration-runner Lambda:

1. Fetches DB password from AWS Secrets Manager
2. Connects to the database in a VPC
3. Runs pending migrations
4. Returns a standardized JSON response
5. Pipeline validates the response before deploying application Lambdas

### Package.json Scripts

Add these scripts to your generated project:

```json
{
  "typeorm": "typeorm-ts-node-commonjs",
  "migration:generate": "pnpm typeorm migration:generate -d src/infrastructure/database/data-source.ts",
  "migration:run": "pnpm typeorm migration:run -d src/infrastructure/database/data-source.ts",
  "migration:revert": "pnpm typeorm migration:revert -d src/infrastructure/database/data-source.ts"
}
```

### Important Notes

- Never use `synchronize: true` in production
- Each migration runs in its own transaction (`transaction: 'each'`)
- Always import migrations in the barrel file (`migrations/index.ts`) for Lambda compatibility
- The CLI data source uses glob patterns (works on filesystem), the Lambda handler uses the barrel file
