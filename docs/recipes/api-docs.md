# API Documentation Recipes

Auto-generate interactive API documentation with Swagger/OpenAPI for your NestJS application.

## Available Recipes

| Recipe  | Description                             | Recipe README                                                 |
| ------- | --------------------------------------- | ------------------------------------------------------------- |
| Swagger | OpenAPI spec generation with Swagger UI | [swagger](../../packages/templates/recipes/swagger/README.md) |

## Setup

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('users')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
}
bootstrap();
```

## Decorating Controllers

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found', type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.findOne(id);
  }
}
```

## DTO Decorators

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email address' })
  email: string;

  @ApiProperty({ example: 'John Doe', minLength: 2, maxLength: 100 })
  name: string;

  @ApiPropertyOptional({ example: '+31612345678' })
  phone?: string;
}
```

## CLI Plugin

Enable the Swagger CLI plugin in `nest-cli.json` to reduce boilerplate -- it auto-infers `@ApiProperty` from TypeScript types.

```json
{
  "compilerOptions": {
    "plugins": ["@nestjs/swagger"]
  }
}
```

## External Documentation

- [NestJS OpenAPI Introduction](https://docs.nestjs.com/openapi/introduction)
- [NestJS OpenAPI Types and Parameters](https://docs.nestjs.com/openapi/types-and-parameters)
- [NestJS OpenAPI Operations](https://docs.nestjs.com/openapi/operations)
- [@nestjs/swagger](https://www.npmjs.com/package/@nestjs/swagger)
- [OpenAPI Specification](https://swagger.io/specification/)
