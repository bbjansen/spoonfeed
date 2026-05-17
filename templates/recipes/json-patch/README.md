# JSON Patch (RFC 6902)

Provides a validation pipe for [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) operations, enabling granular document updates via structured operation arrays.

## Dependencies

- [fast-json-patch](https://www.npmjs.com/package/fast-json-patch) - Apply and validate JSON Patch operations

## Usage

```typescript
import { Controller, Patch, Param, Body, Header } from '@nestjs/common';
import { JsonPatchValidationPipe, JsonPatchOperation } from '@/shared/pipes/json-patch.pipe';
import { applyPatch } from 'fast-json-patch';

@Controller('documents')
export class DocumentsController {
  @Patch(':id')
  @Header('Accept-Patch', 'application/json-patch+json')
  update(@Param('id') id: string, @Body(JsonPatchValidationPipe) operations: JsonPatchOperation[]) {
    return this.service.applyPatch(id, operations);
  }
}
```

## Supported Operations

| Operation | Description                           | Required Fields |
| --------- | ------------------------------------- | --------------- |
| `add`     | Add a value at the target path        | `path`, `value` |
| `remove`  | Remove the value at the target path   | `path`          |
| `replace` | Replace the value at the target path  | `path`, `value` |
| `move`    | Move a value from one path to another | `path`, `from`  |
| `copy`    | Copy a value from one path to another | `path`, `from`  |
| `test`    | Test that a value matches at a path   | `path`, `value` |

## Example Request

```http
PATCH /documents/42 HTTP/1.1
Content-Type: application/json-patch+json

[
  { "op": "replace", "path": "/title", "value": "Updated Title" },
  { "op": "add", "path": "/tags/-", "value": "new-tag" },
  { "op": "remove", "path": "/deprecated" }
]
```

## References

- [RFC 6902 - JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902)
- [RFC 6901 - JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901)
- [fast-json-patch on npm](https://www.npmjs.com/package/fast-json-patch)
