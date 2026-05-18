# Remove Recipe Generator

Remove a recipe from an existing project. The generator removes dependencies, configuration, environment variables, and AI context cleanly.

## Usage

```bash
nx g spoonfeed:remove --recipe=<recipe-id>
```

## Examples

```bash
# Remove Swagger documentation
nx g spoonfeed:remove --recipe=swagger

# Remove JWT authentication
nx g spoonfeed:remove --recipe=jwt-auth

# Remove TypeORM with PostgreSQL
nx g spoonfeed:remove --recipe=typeorm-postgres
```

## What It Does

1. **Validates dependencies** — Checks that no other installed recipe requires the one being removed
2. **Removes dependencies** — Removes recipe-specific packages from `package.json`
3. **Updates app.module.ts** — Removes the recipe's module import from the root application module
4. **Updates main.ts** — Removes the recipe's setup block and associated imports (if any)
5. **Removes environment variables** — Cleans up recipe-specific variables from `.env.example`
6. **Updates AI context** — Removes recipe documentation from `CLAUDE.md`, `.cursor/rules/<recipe-id>.mdc`, and `.github/copilot-instructions.md`
7. **Updates manifest** — Removes the recipe entry from `.spoonfeed.json`

### What Gets Cleaned Up

Every artifact the add generator created is reversed:

- [ ] `package.json` — recipe-specific dependencies removed (shared dependencies kept if another recipe still uses them)
- [ ] `src/app.module.ts` — module import and registration removed
- [ ] `src/main.ts` — setup block and associated imports removed
- [ ] `.env.example` — recipe-specific variable section removed
- [ ] `.spoonfeed.json` — recipe entry removed from the manifest
- [ ] `CLAUDE.md` — recipe documentation section removed
- [ ] `.github/copilot-instructions.md` — recipe documentation section removed
- [ ] `.cursor/rules/<recipe-id>.mdc` — cursor rules file deleted

!!! note "Shared dependencies are preserved"
    If two recipes share a dependency (for example, `@nestjs/swagger` is used by both `swagger` and `pagination`), removing one recipe will not remove the shared package. The generator checks all other installed recipes before deleting any dependency from `package.json`.

## Example Walkthrough: Removing Swagger

Suppose your project currently has `jwt-auth`, `health-checks`, and `swagger` installed. You decide to remove Swagger.

### 1. Run the generator

```bash
nx g spoonfeed:remove --recipe=swagger
```

### 2. What happens

**Files deleted:**

- `.cursor/rules/swagger.mdc`

**Files modified:**

- `package.json` — `@nestjs/swagger` and `@fastify/static` removed from dependencies
- `src/main.ts` — the `DocumentBuilder` / `SwaggerModule` setup block and its imports removed
- `.env.example` — the `# --- Swagger / OpenAPI ---` section removed
- `CLAUDE.md` — the `<!-- @spoonfeed:swagger -->` section removed
- `.github/copilot-instructions.md` — the `<!-- @spoonfeed:swagger -->` section removed
- `.spoonfeed.json` — the `swagger` entry removed from `recipes`

**src/main.ts after removal:**

```typescript
// The swagger block is gone — main.ts returns to its pre-swagger state
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
```

**.env.example after removal:**

```bash
PORT=3000
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=3600s
# The "Swagger / OpenAPI" section is gone
```

### 3. Clean up

```bash
pnpm install   # removes unused packages from node_modules
pnpm build     # verify the project still compiles
pnpm test      # verify no tests reference removed modules
```

## Dependency Protection

If another installed recipe depends on the one you are removing, the generator will reject the operation. For example, removing `jwt-auth` while `auth-flows` is still installed will fail because `auth-flows` requires `jwt-auth`.

Remove dependent recipes first, then remove the base recipe.

!!! warning "Dependent recipes block removal"
    The generator checks the `requires` field of every installed recipe. If any installed recipe lists the one you are removing as a requirement, the operation is rejected. For example:

    ```
    $ nx g spoonfeed:remove --recipe=jwt-auth

    Error: Cannot remove 'jwt-auth': the following installed recipes depend
    on it: 'Auth Flows' (auth-flows). Use --force to remove anyway.
    ```

    To fix this, remove `auth-flows` first, then remove `jwt-auth`. Alternatively, pass `--force` to skip the check — but this will leave `auth-flows` in a broken state with missing dependencies.

## Options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `--recipe` | string | Yes | The recipe ID to remove |
| `--force` | boolean | No | Skip dependency protection check (use with caution) |
