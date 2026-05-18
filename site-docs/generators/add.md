# Add Recipe Generator

Add a recipe to an existing project. The generator installs dependencies, updates configuration, and wires everything into the application module.

## Usage

```bash
nx g spoonfeed:add --recipe=<recipe-id>
```

## Examples

```bash
# Add Swagger documentation
nx g spoonfeed:add --recipe=swagger

# Add JWT authentication
nx g spoonfeed:add --recipe=jwt-auth

# Add TypeORM with PostgreSQL
nx g spoonfeed:add --recipe=typeorm-postgres

# Add OpenTelemetry
nx g spoonfeed:add --recipe=opentelemetry
```

## What It Does

1. **Validates compatibility** — Checks that the recipe is compatible with your project type and does not conflict with already-installed recipes
2. **Installs dependencies** — Adds runtime and dev dependencies to `package.json` with exact versions
3. **Updates app.module.ts** — Adds the recipe's module import to the root application module
4. **Updates main.ts** — Inserts the recipe's setup block (if the recipe defines one)
5. **Adds environment variables** — Appends recipe-specific variables to `.env.example`
6. **Updates AI context** — Adds recipe documentation to `CLAUDE.md`, `.cursor/rules/<recipe-id>.mdc`, and `.github/copilot-instructions.md`
7. **Updates manifest** — Adds the recipe entry to `.spoonfeed.json`

### What Gets Modified

Use this checklist to understand every file the generator touches:

- [ ] `package.json` — new dependencies added with exact versions
- [ ] `src/app.module.ts` — module import and registration added
- [ ] `src/main.ts` — setup block inserted (if the recipe defines one)
- [ ] `.env.example` — recipe-specific variables appended in a marked section
- [ ] `.spoonfeed.json` — recipe entry added to the manifest
- [ ] `CLAUDE.md` — recipe documentation section appended
- [ ] `.github/copilot-instructions.md` — recipe documentation section appended
- [ ] `.cursor/rules/<recipe-id>.mdc` — cursor rules file created

## Example Walkthrough: Adding Swagger

Suppose you have an `http-api` project that was scaffolded with `jwt-auth` and `health-checks`, and you now want to add OpenAPI documentation.

### 1. Run the generator

```bash
nx g spoonfeed:add --recipe=swagger
```

### 2. Before and after

**package.json**

```json
// Before
{
  "dependencies": {
    "@nestjs/common": "11.1.19",
    "@nestjs/core": "11.1.19",
    "@nestjs/jwt": "10.2.0",
    "@nestjs/passport": "10.0.3",
    "@nestjs/platform-fastify": "11.1.19"
  }
}

// After — two dependencies added
{
  "dependencies": {
    "@fastify/static": "8.1.0",
    "@nestjs/common": "11.1.19",
    "@nestjs/core": "11.1.19",
    "@nestjs/jwt": "10.2.0",
    "@nestjs/passport": "10.0.3",
    "@nestjs/platform-fastify": "11.1.19",
    "@nestjs/swagger": "11.4.2"
  }
}
```

**src/main.ts**

```typescript
// Before
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

// After — swagger setup block inserted
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('API')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(process.env.SWAGGER_PATH ?? 'api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
```

**.env.example**

```bash
# Before
PORT=3000
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=3600s

# After — swagger section appended
PORT=3000
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=3600s

# --- Swagger / OpenAPI ---
# Enable Swagger UI
SWAGGER_ENABLED=true
# Swagger UI URL path
SWAGGER_PATH=api/docs
# --- end Swagger / OpenAPI ---
```

**.spoonfeed.json**

```json
{
  "projectType": "http-api",
  "cloudProvider": "none",
  "spoonfeedVersion": "0.1.0",
  "generatedAt": "2026-01-15T10:00:00.000Z",
  "recipes": {
    "jwt-auth": {
      "installedAt": "2026-01-15T10:00:00.000Z",
      "version": "0.1.0",
      "files": ["src/shared/auth/jwt.strategy.ts", "src/shared/auth/jwt-auth.guard.ts"]
    },
    "health-checks": {
      "installedAt": "2026-01-15T10:00:00.000Z",
      "version": "0.1.0",
      "files": ["src/health/health.controller.ts", "src/health/health.module.ts"]
    },
    "swagger": {
      "installedAt": "2026-05-17T14:30:00.000Z",
      "version": "0.1.0",
      "files": [],
      "mainTsBlocks": ["swagger"],
      "envSection": "Swagger / OpenAPI"
    }
  }
}
```

### 3. Install dependencies and verify

```bash
pnpm install
pnpm start:dev
# Visit http://localhost:3000/api/docs to confirm Swagger UI loads
```

## Conflict Handling

If the recipe you are adding conflicts with an already-installed recipe, the generator will reject the operation with a clear error message. For example, adding `prisma` when `typeorm-postgres` is already installed will fail because they conflict.

To switch between conflicting recipes, use the [migrate generator](migrate.md) or [remove](remove.md) the existing recipe first.

!!! warning "Recipe conflicts are mutual"
    Conflict relationships are bidirectional. If `prisma` conflicts with `typeorm-postgres`, then `typeorm-postgres` also conflicts with `prisma`. The same applies to `typeorm-mysql`, `mongoose`, and `drizzle-postgres` — all database ORM recipes are mutually exclusive. Attempting to add any of them when another is already installed will fail. Use `nx g spoonfeed:migrate` to switch between them.

## Requirement Resolution

If a recipe has requirements (e.g., `auth-flows` requires `jwt-auth`), the generator will check that the required recipe is already installed. If not, you will need to add the required recipe first.

!!! warning "Missing requirements block the operation"
    The generator will not auto-install required recipes. If you run `nx g spoonfeed:add --recipe=auth-flows` without `jwt-auth` installed, the command fails with: `Missing requirements: 'auth-flows' requires 'jwt-auth'`. Install `jwt-auth` first, then add `auth-flows`.

## Options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `--recipe` | string | Yes | The recipe ID to add (e.g., `swagger`, `jwt-auth`) |
| `--skip-install` | boolean | No | Skip running `pnpm install` after adding the recipe |
