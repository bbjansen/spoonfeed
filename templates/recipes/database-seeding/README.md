# Database Seeding

Database seed command scaffold for populating development and test data.

## Links

- [NestJS Standalone Applications](https://docs.nestjs.com/standalone-applications)
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)

## Dependencies

No additional dependencies beyond the existing database driver.

| Package | Version | Purpose                           |
| ------- | ------- | --------------------------------- |
| (none)  | -       | Uses existing database connection |

## Usage

Add a seed script to `package.json`:

```json
{
  "scripts": {
    "seed": "ts-node -r tsconfig-paths/register src/infrastructure/database/seed.ts"
  }
}
```

Run the seed command:

```bash
pnpm seed
```

## Generated Files

| File                                  | Description                                        |
| ------------------------------------- | -------------------------------------------------- |
| `src/infrastructure/database/seed.ts` | Standalone NestJS application for database seeding |
