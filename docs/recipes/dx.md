# Developer Experience Recipes

Tools and patterns that improve the inner development loop: containers, data seeding, test factories, and SDK generation.

## Available Recipes

| Recipe             | Purpose                                                    | Recipe README                                                                       |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| DevContainer       | VS Code dev container with all dependencies pre-configured | [devcontainer](../../packages/templates/recipes/devcontainer/README.md)             |
| Database Seeding   | Populate databases with development/test data              | [database-seeding](../../packages/templates/recipes/database-seeding/README.md)     |
| Database Factories | Generate realistic test entities with faker                | [database-factories](../../packages/templates/recipes/database-factories/README.md) |
| SDK Generation     | Auto-generate typed client SDKs from OpenAPI spec          | [sdk-generation](../../packages/templates/recipes/sdk-generation/README.md)         |

## DevContainer

A DevContainer gives every team member an identical development environment with zero local setup.

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "NestJS Dev",
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspace",
  "features": {
    "ghcr.io/devcontainers/features/node:1": { "version": "20" },
  },
  "postCreateCommand": "pnpm install",
  "forwardPorts": [3000, 5432, 6379],
}
```

## Database Seeding

Run seeders to populate your database with realistic data during development.

```typescript
// seeds/user.seeder.ts
export class UserSeeder implements Seeder {
  async run(dataSource: DataSource) {
    await dataSource.getRepository(User).save([
      { email: 'admin@example.com', name: 'Admin', role: 'admin' },
      { email: 'user@example.com', name: 'User', role: 'user' },
    ]);
  }
}
```

## Database Factories

Create entities with realistic data for tests using factories.

```typescript
// factories/user.factory.ts
import { faker } from '@faker-js/faker';

export const createUser = (overrides?: Partial<User>): User => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  createdAt: faker.date.past(),
  ...overrides,
});
```

```typescript
// usage in tests
const user = createUser({ role: 'admin' });
const users = Array.from({ length: 10 }, () => createUser());
```

## SDK Generation

Generate a typed TypeScript client from your OpenAPI/Swagger spec so consumers get auto-completion and type safety.

```bash
# generate client from running API
npx openapi-generator-cli generate \
  -i http://localhost:3000/api-json \
  -g typescript-axios \
  -o ./sdk
```

Alternatively, use `openapi-typescript` for a lighter-weight approach:

```bash
npx openapi-typescript http://localhost:3000/api-json -o ./sdk/api.d.ts
```

## External Documentation

- [Dev Containers Specification](https://containers.dev)
- [@faker-js/faker](https://www.npmjs.com/package/@faker-js/faker)
- [OpenAPI Generator](https://openapi-generator.tech)
- [openapi-typescript](https://www.npmjs.com/package/openapi-typescript)
