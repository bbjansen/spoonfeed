# HTTP API Project Type

## When to Use

Choose `http-api` when you need a REST or GraphQL API that serves HTTP traffic directly. This is the most common project type for backend services that expose endpoints to frontends, mobile apps, or other services.

## Generated File Structure

```
src/
  app/
    health/
      health.controller.ts
      health.controller.spec.ts
      health.module.ts
    example/
      controllers/
        example.controller.ts
        example.controller.spec.ts
      services/
        example.service.ts
        example.service.spec.ts
      dto/
        create-example.dto.ts
        update-example.dto.ts
      example.module.ts
  config/
    app.config.ts
    database.config.ts
    validation.schema.ts
  infrastructure/
    filters/
      all-exceptions.filter.ts
    interceptors/
      logging.interceptor.ts
      transform.interceptor.ts
    pipes/
      validation.pipe.ts
  shared/
    decorators/
    interfaces/
    constants/
  app.module.ts
  main.ts
test/
  app.e2e-spec.ts
  jest-e2e.json
```

## Configuration (Environment Variables)

| Variable         | Default       | Description                  |
| ---------------- | ------------- | ---------------------------- |
| `NODE_ENV`       | `development` | Runtime environment          |
| `PORT`           | `3000`        | Server listen port           |
| `HOST`           | `0.0.0.0`     | Server bind address          |
| `API_PREFIX`     | `api`         | Global route prefix          |
| `CORS_ORIGINS`   | `*`           | Allowed CORS origins         |
| `DB_HOST`        | `localhost`   | Database host (if Postgres)  |
| `DB_PORT`        | `5432`        | Database port                |
| `DB_NAME`        | `app`         | Database name                |
| `DB_USER`        | `postgres`    | Database user                |
| `DB_PASSWORD`    | --            | Database password            |
| `JWT_SECRET`     | --            | JWT signing secret (if auth) |
| `JWT_EXPIRES_IN` | `3600s`       | Token expiration             |
| `LOG_LEVEL`      | `info`        | Minimum log level            |

## Development Workflow

```bash
# Start with hot reload
pnpm start:dev

# Run unit tests
pnpm test

# Run e2e tests (requires running server or test setup)
pnpm test:e2e

# Build for production
pnpm build

# Start production server
pnpm start:prod
```

## Key Patterns

### Controllers

Controllers handle HTTP routing. Keep them thin -- delegate business logic to services.

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { OrderService } from '@/orders/services/order.service';
import { CreateOrderDto } from '@/orders/dto/create-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }
}
```

### Services

Services contain business logic. Each service should have a single responsibility.

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '@/orders/entities/order.entity';
import { CreateOrderDto } from '@/orders/dto/create-order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    const order = this.orderRepo.create(dto);
    return this.orderRepo.save(order);
  }
}
```

### DTOs

Use `class-validator` decorators for request validation and `class-transformer` for serialization.

```typescript
import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  productId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;
}
```

The global `ValidationPipe` automatically validates incoming requests against DTOs and returns structured 400 errors for invalid input.
