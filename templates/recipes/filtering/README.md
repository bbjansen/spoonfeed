# Filtering and Sorting

Reusable filter and sort DTOs for list endpoints.

## Links

- [NestJS Techniques: Serialization](https://docs.nestjs.com/techniques/serialization)
- [class-validator on npm](https://www.npmjs.com/package/class-validator)

## Dependencies

| Package             | Version  | Purpose                   |
| ------------------- | -------- | ------------------------- |
| `class-validator`   | `0.14.1` | DTO validation decorators |
| `class-transformer` | `0.5.1`  | DTO transformation        |

## Usage

```typescript
import { BaseFilterDto, SortDto } from '@/shared/dto/filter.dto';

class UserFilterDto extends BaseFilterDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

@Get()
async findAll(@Query() filter: UserFilterDto): Promise<User[]> {
  return this.userService.findAll(filter);
}
```

## Generated Files

| File                           | Description               |
| ------------------------------ | ------------------------- |
| `src/shared/dto/filter.dto.ts` | Base filter and sort DTOs |
