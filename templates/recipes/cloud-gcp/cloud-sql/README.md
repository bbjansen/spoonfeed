# GCP Cloud SQL

Google Cloud SQL managed database connection for NestJS.

## Documentation

- [GCP Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy)
- [@nestjs/typeorm on npm](https://www.npmjs.com/package/@nestjs/typeorm)
- [NestJS Database — TypeORM](https://docs.nestjs.com/techniques/database)

## Dependencies

| Package           | Version  | Purpose                    |
| ----------------- | -------- | -------------------------- |
| `@nestjs/typeorm` | `10.0.2` | NestJS TypeORM integration |
| `typeorm`         | `0.3.20` | TypeORM core               |
| `pg`              | `8.13.1` | PostgreSQL driver          |

## Environment Variables

| Variable                    | Default    | Description                        |
| --------------------------- | ---------- | ---------------------------------- |
| `GCP_PROJECT_ID`            | —          | GCP project ID                     |
| `CLOUD_SQL_CONNECTION_NAME` | —          | Cloud SQL instance connection name |
| `DB_NAME`                   | `app`      | Database name                      |
| `DB_USERNAME`               | `postgres` | Database username                  |
| `DB_PASSWORD`               | —          | Database password                  |

## Usage

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: '/cloudsql/' + config.get('CLOUD_SQL_CONNECTION_NAME'),
        database: config.get('DB_NAME'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        autoLoadEntities: true,
        extra: { socketPath: '/cloudsql/' + config.get('CLOUD_SQL_CONNECTION_NAME') },
      }),
    }),
  ],
})
export class DatabaseModule {}
```
