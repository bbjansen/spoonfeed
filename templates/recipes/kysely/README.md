# Kysely

Type-safe SQL query builder with zero overhead.

## Links

- [Kysely](https://kysely.dev/)
- [Getting Started](https://kysely.dev/docs/getting-started)
- [npm](https://www.npmjs.com/package/kysely)

## Dependencies

| Package      | Version | Type |
| ------------ | ------- | ---- |
| `kysely`     | 0.27.6  | prod |
| `pg`         | 8.13.1  | prod |
| `kysely-ctl` | 0.9.0   | dev  |

## Environment Variables

| Variable       | Default                                           | Description               |
| -------------- | ------------------------------------------------- | ------------------------- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/app` | PostgreSQL connection URL |

## Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "kysely:migrate": "kysely-ctl migrate",
  "kysely:seed": "kysely-ctl seed",
  "kysely:create-migration": "kysely-ctl create-migration"
}
```

## Usage

```typescript
constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

async findAll(): Promise<User[]> {
  return this.db.selectFrom('users').selectAll().execute();
}

async findById(id: string): Promise<User | undefined> {
  return this.db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
}

async create(user: NewUser): Promise<User> {
  return this.db.insertInto('users').values(user).returningAll().executeTakeFirstOrThrow();
}
```
