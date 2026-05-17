# Response Serialization Groups

Return different field sets based on role or endpoint using class-transformer decorators.

## Links

- [NestJS Serialization Documentation](https://docs.nestjs.com/techniques/serialization)
- [class-transformer on npm](https://www.npmjs.com/package/class-transformer)
- [class-transformer @Expose and @Exclude](https://github.com/typestack/class-transformer#exposing-getters-and-method-return-values)

## Dependencies

No additional dependencies. Uses `class-transformer` which is already included in the base template.

## Usage

### Basic Serialization

Apply `Serialize(DtoClass)` to controller methods to control which fields are returned. Only properties marked with `@Expose()` are included in the response.

```typescript
import { Serialize } from '@/shared/interceptors/serialize.interceptor';
import { Expose, Exclude } from 'class-transformer';

// Define a response DTO
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  // password is NOT exposed — it will be excluded from responses
}

// Apply to controller method
@Controller('users')
export class UserController {
  @Get(':id')
  @Serialize(UserResponseDto)
  findOne(@Param('id') id: string) {
    // Even if the service returns a full user entity with password,
    // only id, name, and email will be in the response
    return this.userService.findOne(id);
  }
}
```

### Groups for Role-Based Visibility

Use the `groups` option on `@Expose()` to show different fields based on the requester's role:

```typescript
export class UserDetailDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose({ groups: ['admin', 'self'] })
  email: string;

  @Expose({ groups: ['admin'] })
  role: string;

  @Expose({ groups: ['admin'] })
  createdAt: Date;
}
```

To use groups, pass them when calling `plainToInstance`:

```typescript
plainToInstance(UserDetailDto, user, {
  excludeExtraneousValues: true,
  groups: ['admin'],
});
```

### Using @Exclude()

You can also use `@Exclude()` to explicitly exclude specific fields while including everything else:

```typescript
export class UserDto {
  id: string;
  name: string;

  @Exclude()
  password: string;

  @Exclude()
  internalNotes: string;
}
```

## Generated Files

| File                                               | Description                                          |
| -------------------------------------------------- | ---------------------------------------------------- |
| `src/shared/interceptors/serialize.interceptor.ts` | Serialize() decorator and SerializeInterceptor class |
