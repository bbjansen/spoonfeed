# API Pattern Recipes

Common REST API patterns for NestJS. Pagination, filtering, versioning, and request correlation.

## Available Recipes

| Recipe         | Purpose                               | Recipe README                                                               |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| Pagination     | Cursor and offset-based pagination    | [pagination](../../packages/templates/recipes/pagination/README.md)         |
| Filtering      | Query parameter filtering and sorting | [filtering](../../packages/templates/recipes/filtering/README.md)           |
| API Versioning | URI, header, or media-type versioning | [api-versioning](../../packages/templates/recipes/api-versioning/README.md) |
| Correlation ID | Request tracing across services       | [correlation-id](../../packages/templates/recipes/correlation-id/README.md) |

## Pagination

Two common strategies:

| Strategy     | Pros                       | Cons                                     | Use When                        |
| ------------ | -------------------------- | ---------------------------------------- | ------------------------------- |
| Offset-based | Simple, random page access | Slow on large datasets, drift on inserts | Small datasets, admin UIs       |
| Cursor-based | Consistent, fast at scale  | No random page access                    | Infinite scroll, large datasets |

```typescript
// offset-based example
@Get()
findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
  return this.service.findAll({ skip: (page - 1) * limit, take: limit });
}
```

```typescript
// cursor-based example
@Get()
findAll(@Query('cursor') cursor?: string, @Query('limit') limit = 20) {
  return this.service.findAll({ cursor, take: limit });
}
```

## Filtering

```typescript
// GET /products?category=electronics&minPrice=100&sort=price:asc
@Get()
findAll(@Query() filters: ProductFilterDto) {
  return this.service.findAll(filters);
}
```

```typescript
export class ProductFilterDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @Type(() => Number) @IsNumber() minPrice?: number;
  @IsOptional() @IsString() sort?: string; // field:direction
}
```

## API Versioning

```typescript
// main.ts
import { VersioningType } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI, // /v1/users, /v2/users
});
```

```typescript
@Controller({ path: 'users', version: '1' })
export class UsersV1Controller {}

@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {}
```

| Type       | Format                                | Example                         |
| ---------- | ------------------------------------- | ------------------------------- |
| URI        | `/v1/resource`                        | Most common, easy to understand |
| Header     | `X-API-Version: 1`                    | Cleaner URLs                    |
| Media Type | `Accept: application/vnd.api.v1+json` | REST purist approach            |

## Correlation ID

Attach a unique ID to every request for distributed tracing.

```typescript
// correlation-id.middleware.ts
import { v4 as uuid } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] || uuid();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
```

## External Documentation

- [NestJS Versioning](https://docs.nestjs.com/techniques/versioning)
- [NestJS Validation](https://docs.nestjs.com/techniques/validation)
- [class-validator](https://www.npmjs.com/package/class-validator)
- [class-transformer](https://www.npmjs.com/package/class-transformer)
