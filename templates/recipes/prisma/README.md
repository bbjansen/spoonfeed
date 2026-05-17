# Prisma

Type-safe database client using Prisma ORM for NestJS applications.

## Links

- [NestJS Prisma Recipe](https://docs.nestjs.com/recipes/prisma)
- [Prisma Documentation](https://www.prisma.io/docs)
- [prisma on npm](https://www.npmjs.com/package/prisma)
- [@prisma/client on npm](https://www.npmjs.com/package/@prisma/client)
- [Prisma on GitHub](https://github.com/prisma/prisma)

## Setup

> **Important:** Run `pnpm prisma generate` after installation to generate the typed client.
> Then update `src/infrastructure/database/prisma.service.ts` to extend `PrismaClient`
> as described in the inline comments.

## Dependencies

| Package          | Version | Purpose                                  |
| ---------------- | ------- | ---------------------------------------- |
| `prisma`         | `6.2.1` | Prisma CLI and migration engine          |
| `@prisma/client` | `6.2.1` | Auto-generated type-safe database client |

## Environment Variables

| Variable       | Default | Description                                                                    |
| -------------- | ------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL` | —       | Full database connection URL (e.g. `postgresql://user:pass@localhost:5432/db`) |

## Usage

```typescript
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }
}
```

## Generated Files

| File                                            | Description                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `prisma/schema.prisma`                          | Base Prisma schema with datasource and generator configuration   |
| `src/infrastructure/database/prisma.service.ts` | PrismaService extending PrismaClient with NestJS lifecycle hooks |
