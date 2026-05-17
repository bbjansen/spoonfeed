# SDK Generation

Client SDK generation from OpenAPI specifications using OpenAPI Generator.

## Links

- [OpenAPI Generator](https://openapi-generator.tech)
- [OpenAPI Generator CLI on npm](https://www.npmjs.com/package/@openapitools/openapi-generator-cli)
- [OpenAPI Generator on GitHub](https://github.com/OpenAPITools/openapi-generator)

## Dependencies

| Package                               | Version  | Purpose                           |
| ------------------------------------- | -------- | --------------------------------- |
| `@openapitools/openapi-generator-cli` | `2.16.3` | CLI wrapper for OpenAPI Generator |

## Usage

Add generation scripts to `package.json`:

```json
{
  "scripts": {
    "sdk:generate": "openapi-generator-cli generate",
    "sdk:validate": "openapi-generator-cli validate -i openapi.json"
  }
}
```

Run SDK generation:

```bash
pnpm sdk:generate
```

## Generated Files

| File                | Description                         |
| ------------------- | ----------------------------------- |
| `openapitools.json` | OpenAPI Generator CLI configuration |
