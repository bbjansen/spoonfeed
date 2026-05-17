# Swagger / OpenAPI

API documentation using Swagger UI and OpenAPI specification for NestJS applications.

## Links

- [NestJS OpenAPI Documentation](https://docs.nestjs.com/openapi/introduction)
- [@nestjs/swagger on npm](https://www.npmjs.com/package/@nestjs/swagger)
- [@nestjs/swagger on GitHub](https://github.com/nestjs/swagger)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)

## Dependencies

| Package           | Version | Purpose                            |
| ----------------- | ------- | ---------------------------------- |
| `@nestjs/swagger` | `8.1.0` | NestJS Swagger/OpenAPI integration |

## Environment Variables

| Variable          | Default    | Description                  |
| ----------------- | ---------- | ---------------------------- |
| `SWAGGER_ENABLED` | `true`     | Enable or disable Swagger UI |
| `SWAGGER_PATH`    | `api/docs` | URL path for Swagger UI      |

## Usage

```typescript
// In main.ts
import { setupSwagger } from '@/main.swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupSwagger(app);
  await app.listen(3000);
}
```

## Generated Files

| File                  | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `src/main.swagger.ts` | Swagger setup function using DocumentBuilder and SwaggerModule |
