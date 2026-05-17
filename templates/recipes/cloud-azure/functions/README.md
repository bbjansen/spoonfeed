# Azure Functions

Azure Functions integration for serverless NestJS workloads.

## Documentation

- [Azure Functions Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [@azure/functions on npm](https://www.npmjs.com/package/@azure/functions)
- [NestJS Serverless](https://docs.nestjs.com/faq/serverless)

## Dependencies

| Package            | Version | Purpose                 |
| ------------------ | ------- | ----------------------- |
| `@azure/functions` | `4.6.0` | Azure Functions runtime |

## Environment Variables

| Variable                      | Default       | Description                 |
| ----------------------------- | ------------- | --------------------------- |
| `AZURE_FUNCTIONS_ENVIRONMENT` | `Development` | Azure Functions environment |

## Usage

```typescript
import { app } from '@azure/functions';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let cachedApp: INestApplication;

async function getApp(): Promise<INestApplication> {
  if (!cachedApp) {
    cachedApp = await NestFactory.create(AppModule);
    await cachedApp.init();
  }
  return cachedApp;
}

app.http('handler', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  route: '{*path}',
  handler: async (request, context) => {
    const nestApp = await getApp();
    return nestApp.getHttpAdapter().getInstance()(request, context);
  },
});
```
