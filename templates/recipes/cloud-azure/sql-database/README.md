# Azure SQL Database

Azure SQL Database managed connection for NestJS.

## Documentation

- [Azure SQL Database Documentation](https://learn.microsoft.com/en-us/azure/azure-sql/database/)
- [mssql on npm](https://www.npmjs.com/package/mssql)
- [@nestjs/typeorm on npm](https://www.npmjs.com/package/@nestjs/typeorm)
- [NestJS Database — TypeORM](https://docs.nestjs.com/techniques/database)

## Dependencies

| Package           | Version  | Purpose                     |
| ----------------- | -------- | --------------------------- |
| `@nestjs/typeorm` | `10.0.2` | NestJS TypeORM integration  |
| `typeorm`         | `0.3.20` | TypeORM core                |
| `mssql`           | `11.0.1` | Microsoft SQL Server driver |

## Environment Variables

| Variable             | Default | Description               |
| -------------------- | ------- | ------------------------- |
| `AZURE_SQL_HOST`     | —       | Azure SQL server hostname |
| `AZURE_SQL_PORT`     | `1433`  | Azure SQL port            |
| `AZURE_SQL_DATABASE` | `app`   | Azure SQL database name   |
| `AZURE_SQL_USERNAME` | —       | Azure SQL username        |
| `AZURE_SQL_PASSWORD` | —       | Azure SQL password        |

## Usage

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mssql',
        host: config.getOrThrow('AZURE_SQL_HOST'),
        port: config.get<number>('AZURE_SQL_PORT', 1433),
        database: config.get('AZURE_SQL_DATABASE'),
        username: config.get('AZURE_SQL_USERNAME'),
        password: config.get('AZURE_SQL_PASSWORD'),
        options: { encrypt: true, trustServerCertificate: false },
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
```
