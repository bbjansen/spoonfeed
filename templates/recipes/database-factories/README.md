# Database Factories

Test factory pattern for creating consistent test data with type-safe overrides.

## Links

- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Factory Pattern](https://refactoring.guru/design-patterns/factory-method)

## Dependencies

No additional dependencies required.

| Package | Version | Purpose                           |
| ------- | ------- | --------------------------------- |
| (none)  | -       | Pure TypeScript factory functions |

## Usage

```typescript
import { createFactory } from '@tests/factories/base.factory';

interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}

const userFactory = createFactory<User>(() => ({
  id: crypto.randomUUID(),
  email: `user-${Date.now()}@example.com`,
  name: 'Test User',
  isActive: true,
}));

// Create a single entity
const user = userFactory.build({ name: 'Alice' });

// Create multiple entities
const users = userFactory.buildMany(5, { isActive: false });
```

## Generated Files

| File                              | Description                      |
| --------------------------------- | -------------------------------- |
| `tests/factories/base.factory.ts` | Generic factory builder function |
