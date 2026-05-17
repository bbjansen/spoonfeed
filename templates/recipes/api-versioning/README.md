# API Versioning

URI-based API versioning for NestJS.

## Links

- [NestJS Versioning](https://docs.nestjs.com/techniques/versioning)

## Dependencies

No additional dependencies required. Versioning is built into NestJS core.

| Package | Version | Purpose                    |
| ------- | ------- | -------------------------- |
| (none)  | -       | Built-in to `@nestjs/core` |

## Usage

Enable versioning in `main.ts`:

```typescript
import { VersioningType } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
  prefix: 'v',
});
```

Use version-specific controllers:

```typescript
@Controller({ path: 'users', version: '1' })
export class UsersV1Controller {
  @Get()
  findAll() {
    return [];
  }
}

@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {
  @Get()
  findAll() {
    return { items: [], total: 0 };
  }
}
```

Or version individual routes:

```typescript
@Version('2')
@Get()
findAllV2() { return { items: [], total: 0 }; }
```

## Generated Files

| File   | Description                                 |
| ------ | ------------------------------------------- |
| (none) | Applied directly in `main.ts` configuration |
