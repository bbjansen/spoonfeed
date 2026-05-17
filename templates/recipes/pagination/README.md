# Pagination

Offset-based pagination pattern with reusable DTOs and a parameter decorator.

## Links

- [NestJS Techniques: Serialization](https://docs.nestjs.com/techniques/serialization)
- [class-validator on npm](https://www.npmjs.com/package/class-validator)
- [class-transformer on npm](https://www.npmjs.com/package/class-transformer)

## Dependencies

| Package             | Version  | Purpose                   |
| ------------------- | -------- | ------------------------- |
| `class-validator`   | `0.14.1` | DTO validation decorators |
| `class-transformer` | `0.5.1`  | DTO transformation        |

## Usage

```typescript
import { PaginatedQuery, PaginatedResponse } from '@/shared/dto/pagination.dto';
import { Paginate } from '@/shared/decorators/paginate.decorator';

@Get()
async findAll(@Paginate() query: PaginatedQuery): Promise<PaginatedResponse<User>> {
  const [items, total] = await this.userRepo.findAndCount({
    skip: query.skip,
    take: query.limit,
  });

  return new PaginatedResponse(items, total, query.page, query.limit);
}
```

## RFC 8288 Link Headers

The pagination recipe includes an interceptor that automatically adds [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) `Link` headers to paginated responses. These headers allow API clients to navigate between pages without parsing the response body.

### Setup

Apply the `PaginationLinkInterceptor` globally or on specific controllers:

```typescript
import { PaginationLinkInterceptor } from '@/shared/interceptors/pagination-link.interceptor';

// Global (in main.ts or AppModule)
app.useGlobalInterceptors(new PaginationLinkInterceptor());

// Or per-controller
@UseInterceptors(PaginationLinkInterceptor)
@Controller('users')
export class UserController {}
```

The interceptor inspects each response for a `pagination` property. When found, it generates a `Link` header with `prev`, `next`, `first`, and `last` relations:

```
Link: <https://api.example.com/users?page=2&pageSize=20>; rel="next",
      <https://api.example.com/users?page=1&pageSize=20>; rel="first",
      <https://api.example.com/users?page=5&pageSize=20>; rel="last"
```

A standalone `buildPaginationLinks` utility is also exported from `pagination.dto.ts` for manual use.

## Generated Files

| File                                                     | Description                                   |
| -------------------------------------------------------- | --------------------------------------------- |
| `src/shared/dto/pagination.dto.ts`                       | `PaginatedQuery` and `PaginatedResponse` DTOs |
| `src/shared/decorators/paginate.decorator.ts`            | `@Paginate()` parameter decorator             |
| `src/shared/interceptors/pagination-link.interceptor.ts` | RFC 8288 `Link` header interceptor            |
