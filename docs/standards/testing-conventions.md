# Testing Conventions

## Test Directory Structure

```
src/
  orders/
    order.service.ts
    order.service.spec.ts              # Unit test (co-located)
    order.controller.ts
    order.controller.spec.ts           # Unit test (co-located)
tests/
  integration/
    orders/
      order.service.integration.spec.ts
  e2e/
    orders.e2e-spec.ts
  factories/
    order.factory.ts
    user.factory.ts
  jest.config.ts                       # Multi-project Jest config
```

## Naming Conventions

| Test Type   | File Pattern            | Location               |
| ----------- | ----------------------- | ---------------------- |
| Unit        | `*.spec.ts`             | Co-located with source |
| Integration | `*.integration.spec.ts` | `tests/integration/`   |
| E2E         | `*.e2e-spec.ts`         | `tests/e2e/`           |

## Unit Test Rules

### What to Test

- All public service methods (happy path, edge cases, error paths)
- Controller route handlers (input validation, response mapping)
- Pipes, guards, interceptors, and decorators

### Mocking Policy

**Mock only external dependencies:**

- Databases and ORMs (repositories, query builders)
- HTTP clients (axios, fetch, external APIs)
- Third-party SDKs (AWS, Stripe, SendGrid)
- File system, network, time

**Never mock code you own.** If you need to mock an internal service, it may indicate a design issue -- consider refactoring.

### Import Style

Always use `@/` path aliases in tests:

```typescript
// correct
import { OrderService } from '@/orders/order.service';

// wrong
import { OrderService } from '../../src/orders/order.service';
```

### Example Unit Test

```typescript
import { Test } from '@nestjs/testing';
import { OrderService } from '@/orders/order.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '@/orders/order.entity';
import { NotFoundException } from '@nestjs/common';

describe('OrderService', () => {
  let service: OrderService;
  const mockRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrderService, { provide: getRepositoryToken(Order), useValue: mockRepo }],
    }).compile();

    service = module.get(OrderService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findOne', () => {
    it('should return the order when found', async () => {
      const order = { id: '1', total: 100 };
      mockRepo.findOne.mockResolvedValue(order);

      expect(await service.findOne('1')).toEqual(order);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });
});
```

## Integration Test Rules

### When to Write Integration Tests

- Database queries with complex joins or conditions
- Module interactions that span multiple providers
- Cache invalidation logic
- Transaction boundaries

### Use Testcontainers for Real Dependencies

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('OrderService (integration)', () => {
  let container;
  let service: OrderService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();

    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [Order],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Order]),
      ],
      providers: [OrderService],
    }).compile();

    service = module.get(OrderService);
  });

  afterAll(async () => {
    await container.stop();
  });

  it('should persist and retrieve an order', async () => {
    const created = await service.create({ productId: 'abc', quantity: 2 });
    const found = await service.findOne(created.id);

    expect(found.productId).toBe('abc');
  });
});
```

## E2E Test Rules

### What E2E Tests Cover

- Full HTTP request/response cycle
- Authentication and authorization flows
- Input validation (400 responses)
- Error responses (404, 409, 500)

### Use Supertest

```typescript
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

describe('Orders (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  it('POST /orders -- should create an order', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ productId: 'abc', quantity: 2 })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
      });
  });

  it('GET /orders/:id -- should return 404 for missing order', () => {
    return request(app.getHttpServer()).get('/orders/nonexistent').expect(404);
  });
});
```

## Test Factories

Use factories to create test data consistently across all test types.

```typescript
// tests/factories/order.factory.ts
import { Order } from '@/orders/order.entity';

let counter = 0;

export function buildOrder(overrides: Partial<Order> = {}): Order {
  counter++;
  return {
    id: `order-${counter}`,
    productId: `product-${counter}`,
    quantity: 1,
    total: 10.0,
    status: 'pending',
    createdAt: new Date(),
    ...overrides,
  } as Order;
}
```

Usage:

```typescript
const order = buildOrder({ status: 'shipped', total: 99.99 });
```

## Coverage Thresholds

| Test Type   | Recommended Threshold                                         |
| ----------- | ------------------------------------------------------------- |
| Unit        | 80% (lines)                                                   |
| Integration | 60% (lines)                                                   |
| E2E         | Not measured by line coverage; measure route coverage instead |

Configure in `jest.config.ts`:

```typescript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
```

## Jest Configuration (Multi-Project)

```typescript
// jest.config.ts
export default {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      transform: { '^.+\\.ts$': '@swc/jest' },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.integration.spec.ts'],
      transform: { '^.+\\.ts$': '@swc/jest' },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.e2e-spec.ts'],
      transform: { '^.+\\.ts$': '@swc/jest' },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
};
```

Run specific test suites:

```bash
pnpm test              # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:e2e          # E2E tests only
pnpm test:all          # All test suites
pnpm test:cov          # Unit + integration with coverage
```
