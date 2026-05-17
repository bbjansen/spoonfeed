# Database Migration

Create and run database migrations.

## TypeORM

### Create a migration

```bash
pnpm typeorm migration:create src/database/migrations/<MigrationName>
```

### Generate a migration from entity changes

```bash
pnpm typeorm migration:generate src/database/migrations/<MigrationName> -d src/database/data-source.ts
```

### Run pending migrations

```bash
pnpm typeorm migration:run -d src/database/data-source.ts
```

### Revert the last migration

```bash
pnpm typeorm migration:revert -d src/database/data-source.ts
```

### Rules

- Migration class names use PascalCase with a timestamp prefix (auto-generated)
- Each migration must implement both `up()` and `down()` methods
- Never modify a migration that has already been applied in any environment
- Test both `up` and `down` directions locally before committing

## Prisma

### Create a migration

```bash
pnpm prisma migrate dev --name <migration-name>
```

### Apply migrations in production

```bash
pnpm prisma migrate deploy
```

### Reset the database (development only)

```bash
pnpm prisma migrate reset
```

### Generate Prisma client after schema changes

```bash
pnpm prisma generate
```

### Rules

- Migration names use kebab-case (e.g. `add-user-email-index`)
- Edit `prisma/schema.prisma` first, then generate the migration
- Never edit migration SQL files after they have been applied
- Always run `pnpm prisma generate` after schema changes
