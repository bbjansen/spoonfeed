# Drizzle ORM + PostgreSQL

Lightweight type-safe ORM with best-in-class performance.

## Links

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Get Started with PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)
- [drizzle-orm on npm](https://www.npmjs.com/package/drizzle-orm)

## Dependencies

| Package       | Version | Type |
| ------------- | ------- | ---- |
| `drizzle-orm` | 0.44.2  | prod |
| `pg`          | 8.13.1  | prod |
| `drizzle-kit` | 0.31.1  | dev  |

## Environment Variables

| Variable       | Default                                           | Description               |
| -------------- | ------------------------------------------------- | ------------------------- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/app` | PostgreSQL connection URL |

## Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "drizzle:generate": "drizzle-kit generate",
  "drizzle:migrate": "drizzle-kit migrate",
  "drizzle:studio": "drizzle-kit studio"
}
```

## Usage

Import the `DrizzleModule` in your `AppModule`. Then inject the database connection using the `DRIZZLE` token:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/infrastructure/database/drizzle.module';
import * as schema from '@/infrastructure/database/schema';

@Injectable()
export class UserRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async findAll() {
    return this.db.select().from(schema.users);
  }
}
```

## Schema

Define tables in `src/infrastructure/database/schema/` and export them from the `index.ts` barrel file. See `example.ts` for a reference.

## Migrations

After changing schema files:

1. Generate migration: `pnpm drizzle:generate`
2. Apply migration: `pnpm drizzle:migrate`

Use `pnpm drizzle:studio` to browse your database visually.
