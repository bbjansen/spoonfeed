# AWS RDS

AWS RDS managed database connection with IAM authentication support for NestJS.

> **Note:** RDS does not require a dedicated service wrapper. Database access is handled through
> TypeORM or Prisma, configured directly in a module. See the
> [`typeorm-postgres`](../../database/typeorm-postgres/) recipe for a complete setup.

## Documentation

- [AWS RDS User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/)
- [AWS RDS IAM Authentication](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)
- [@nestjs/typeorm on npm](https://www.npmjs.com/package/@nestjs/typeorm)
- [NestJS Database — TypeORM](https://docs.nestjs.com/techniques/database)

## Dependencies

| Package           | Version  | Purpose                    |
| ----------------- | -------- | -------------------------- |
| `@nestjs/typeorm` | `10.0.2` | NestJS TypeORM integration |
| `typeorm`         | `0.3.20` | TypeORM core               |
| `pg`              | `8.13.1` | PostgreSQL driver          |

## Environment Variables

| Variable       | Default     | Description           |
| -------------- | ----------- | --------------------- |
| `AWS_REGION`   | `eu-west-1` | AWS region            |
| `RDS_HOST`     | —           | RDS instance endpoint |
| `RDS_PORT`     | `5432`      | RDS port              |
| `RDS_DATABASE` | `app`       | RDS database name     |
| `RDS_USERNAME` | `postgres`  | RDS username          |
| `RDS_PASSWORD` | —           | RDS password          |

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
        host: config.get('RDS_HOST'),
        port: config.getOrThrow<number>('RDS_PORT'),
        database: config.get('RDS_DATABASE'),
        username: config.get('RDS_USERNAME'),
        password: config.get('RDS_PASSWORD'),
        ssl: { rejectUnauthorized: true },
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
```
