# Migrate Recipe Generator

Migrate between compatible recipes in a single operation. The generator removes the old recipe and adds the new one atomically, handling dependency changes, source file replacements, and configuration updates.

## Usage

```bash
nx g spoonfeed:migrate --from=<recipe-id> --to=<recipe-id>
```

## Examples

```bash
# Migrate from TypeORM to Prisma
nx g spoonfeed:migrate --from=typeorm-postgres --to=prisma

# Migrate from Pino to Winston
nx g spoonfeed:migrate --from=pino --to=winston

# Migrate from Nodemailer to SendGrid
nx g spoonfeed:migrate --from=nodemailer --to=sendgrid
```

## What It Does

1. **Validates compatibility** — Checks that the target recipe is compatible with your project type and does not conflict with other installed recipes (excluding the one being replaced)
2. **Removes the old recipe** — Removes dependencies, configuration, environment variables, and AI context from the old recipe
3. **Adds the new recipe** — Installs dependencies, updates configuration, adds environment variables, and adds AI context for the new recipe
4. **Updates app.module.ts** — Replaces the old module import with the new one
5. **Updates AI context** — Replaces old recipe documentation with new recipe documentation in all AI context files

### The Two-step Process

Under the hood, `migrate` is a sequenced `remove` followed by `add`. The generator:

1. Calls the [remove generator](remove.md) with `--force` (bypassing dependency checks since the replacement will satisfy them)
2. Calls the [add generator](add.md) to install the target recipe

Both steps run against the same Nx file tree, so the changes are written atomically — either both succeed or neither is applied. After the file changes are written, the generator prints migration guidance specific to the recipe pair.

## Compatible Migrations

Migration works between recipes in the same category that conflict with each other. Common migration paths:

| From | To | Category |
| --- | --- | --- |
| `typeorm-postgres` | `prisma` | Database |
| `typeorm-postgres` | `drizzle-postgres` | Database |
| `typeorm-postgres` | `mikro-orm` | Database |
| `prisma` | `typeorm-postgres` | Database |
| `pino` | `winston` | Logging |
| `winston` | `pino` | Logging |
| `nodemailer` | `sendgrid` | Email |
| `sendgrid` | `nodemailer` | Email |
| `json-patch` | `json-merge-patch` | API Patterns |

!!! note "Cross-category migration is not supported"
    Both recipes must belong to the same category. Attempting to migrate from `typeorm-postgres` (Database) to `pino` (Logging) will fail with: `Cannot migrate between different categories`.

## Example Walkthrough: TypeORM to Prisma

Suppose your project uses `typeorm-postgres` and you want to switch to Prisma.

### 1. Run the migration

```bash
nx g spoonfeed:migrate --from=typeorm-postgres --to=prisma
```

### 2. What changes

**Step 1 — Remove `typeorm-postgres`:**

- `package.json`: `@nestjs/typeorm`, `typeorm`, `pg` removed from dependencies
- `src/app.module.ts`: `TypeOrmModule` import removed
- `.env.example`: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` variables removed
- AI context files: TypeORM sections removed
- `.spoonfeed.json`: `typeorm-postgres` entry removed

**Step 2 — Add `prisma`:**

- `package.json`: `@prisma/client` added to dependencies, `prisma` added to devDependencies
- `src/app.module.ts`: `PrismaModule` import added
- `.env.example`: `DATABASE_URL` variable added
- AI context files: Prisma sections appended
- `.spoonfeed.json`: `prisma` entry added

**package.json before and after:**

```json
// Before
{
  "dependencies": {
    "@nestjs/typeorm": "10.0.2",
    "pg": "8.13.1",
    "typeorm": "0.3.20"
  }
}

// After
{
  "dependencies": {
    "@prisma/client": "6.2.1"
  },
  "devDependencies": {
    "prisma": "6.2.1"
  }
}
```

**.env.example before and after:**

```bash
# Before
# --- TypeORM + PostgreSQL ---
# PostgreSQL host
DB_HOST=localhost
# PostgreSQL port
DB_PORT=5432
# PostgreSQL username
DB_USERNAME=postgres
# PostgreSQL password
DB_PASSWORD=postgres
# PostgreSQL database name
DB_NAME=app
# --- end TypeORM + PostgreSQL ---

# After
# --- Prisma ---
# Prisma database connection URL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
# --- end Prisma ---
```

### 3. Migration guidance

After the file changes, the generator prints guidance specific to the `typeorm-postgres` to `prisma` migration:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MIGRATION GUIDANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Migration from TypeORM to Prisma requires a schema-first approach:

  1. Introspect your existing database to generate a Prisma schema:
     npx prisma db pull

  2. Replace @InjectRepository() with PrismaService injection.
     - Rewrite queries: repo.find() → prisma.user.findMany().

  3. Remove old TypeORM entity files and migration directory.
  4. Run: npx prisma generate to create the type-safe client.

  See docs/recipes/database.md for full migration guides.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. Manual steps after migration

The generator handles the infrastructure swap (dependencies, config files, environment variables, module wiring), but you still need to convert your application code:

1. **Introspect the database**: `npx prisma db pull` generates `prisma/schema.prisma` from your existing tables
2. **Generate the client**: `npx prisma generate` creates the type-safe Prisma client
3. **Rewrite repository code**: replace `@InjectRepository(User)` with `PrismaService` injection, and convert TypeORM query builder calls to Prisma client methods
4. **Delete old entities**: remove TypeORM `@Entity` classes from `src/<module>/entities/`
5. **Delete old migrations**: remove the TypeORM migrations directory
6. **Run tests**: `pnpm test` to verify everything compiles and passes

!!! note "Data migration is not handled"
    The migrate generator handles schema-level infrastructure only (dependencies, config, source scaffolds). It does not migrate data between databases, convert existing TypeORM migration files to Prisma migrations, or rewrite your application queries. Those are manual steps you perform after running the generator.

## Important Notes

!!! warning
    Migration replaces source files and configuration but does not migrate your application code. After a database ORM migration, you will need to rewrite queries, entities, and repository calls to match the new ORM's API.

## Options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `--from` | string | Yes | The recipe ID to migrate from |
| `--to` | string | Yes | The recipe ID to migrate to |
