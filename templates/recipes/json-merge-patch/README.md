# JSON Merge Patch (RFC 7396)

Provides a validation pipe for [RFC 7396 JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7396), enabling simple partial updates using plain JSON objects.

## Dependencies

None -- JSON Merge Patch uses built-in language features only.

## Usage

```typescript
import { Controller, Patch, Param, Body, Header } from '@nestjs/common';
import { MergePatchValidationPipe } from '@/shared/pipes/merge-patch.pipe';

@Controller('users')
export class UsersController {
  @Patch(':id')
  @Header('Accept-Patch', 'application/merge-patch+json')
  update(@Param('id') id: string, @Body(MergePatchValidationPipe) patch: Record<string, unknown>) {
    return this.service.mergePatch(id, patch);
  }
}
```

## How It Works

JSON Merge Patch applies partial updates with simple rules:

- **Present keys** with a value overwrite the existing value
- **Null values** delete the corresponding key from the target
- **Nested objects** are merged recursively
- **Arrays** are replaced entirely (not merged element-by-element)

## Example Request

```http
PATCH /users/42 HTTP/1.1
Content-Type: application/merge-patch+json

{
  "email": "new@example.com",
  "nickname": null,
  "address": {
    "city": "Amsterdam"
  }
}
```

This request updates `email`, removes `nickname`, and updates only `address.city` while preserving other address fields.

## References

- [RFC 7396 - JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7396)
