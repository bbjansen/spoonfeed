# Database Recipes

Database integration options for NestJS applications. Choose based on your data model complexity, team experience, and performance requirements.

## Available Recipes

| Recipe               | ORM Style                      | Best For                                     | Recipe README                                                                   |
| -------------------- | ------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------- |
| TypeORM + PostgreSQL | Active Record / Data Mapper    | Relational data, complex queries, migrations | [typeorm-postgres](../../packages/templates/recipes/typeorm-postgres/README.md) |
| TypeORM + MySQL      | Active Record / Data Mapper    | MySQL/MariaDB environments                   | [typeorm-mysql](../../packages/templates/recipes/typeorm-mysql/README.md)       |
| Prisma               | Schema-first, generated client | Type safety, rapid prototyping, modern DX    | [prisma](../../packages/templates/recipes/prisma/README.md)                     |
| Mongoose             | Schema-based ODM               | Document databases, flexible schemas         | [mongoose](../../packages/templates/recipes/mongoose/README.md)                 |

## Comparison

| Feature           | TypeORM                         | Prisma                             | Mongoose                      |
| ----------------- | ------------------------------- | ---------------------------------- | ----------------------------- |
| Database          | PostgreSQL, MySQL, SQLite, etc. | PostgreSQL, MySQL, SQLite, MongoDB | MongoDB                       |
| Schema definition | Decorators on entities          | `.prisma` schema file              | `Schema` class                |
| Migrations        | CLI + auto-generate             | `prisma migrate`                   | Not built-in                  |
| Type safety       | Moderate                        | Excellent (generated types)        | Moderate                      |
| Raw queries       | Supported                       | `$queryRaw`                        | `aggregate()` / native driver |
| Relations         | Eager/lazy via decorators       | Explicit `include`                 | `populate()`                  |
| Learning curve    | Medium                          | Low                                | Low                           |

## Quick Start: TypeORM + PostgreSQL

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: false, // never true in production
    }),
  ],
})
export class AppModule {}
```

```typescript
// users/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;
}
```

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

## External Documentation

- [NestJS Database Techniques](https://docs.nestjs.com/techniques/database)
- [NestJS Prisma Recipe](https://docs.nestjs.com/recipes/prisma)
- [NestJS MongoDB](https://docs.nestjs.com/techniques/mongodb)
- [TypeORM Documentation](https://typeorm.io)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Mongoose Documentation](https://mongoosejs.com/docs)

## Related Recipes

- [Database Seeding](../../packages/templates/recipes/database-seeding/README.md) -- populate development/test data
- [Database Factories](../../packages/templates/recipes/database-factories/README.md) -- generate realistic test entities
