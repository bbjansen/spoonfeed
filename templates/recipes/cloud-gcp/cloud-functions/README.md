# GCP Cloud Functions

Google Cloud Functions integration for serverless NestJS workloads.

## Documentation

- [GCP Cloud Functions Documentation](https://cloud.google.com/functions/docs)
- [@google-cloud/functions-framework on npm](https://www.npmjs.com/package/@google-cloud/functions-framework)
- [NestJS Serverless](https://docs.nestjs.com/faq/serverless)

## Dependencies

| Package                             | Version | Purpose                           |
| ----------------------------------- | ------- | --------------------------------- |
| `@google-cloud/functions-framework` | `3.4.5` | Cloud Functions runtime framework |

## Environment Variables

| Variable          | Default   | Description                |
| ----------------- | --------- | -------------------------- |
| `GCP_PROJECT_ID`  | —         | GCP project ID             |
| `FUNCTION_TARGET` | `handler` | Cloud Function entry point |

## Usage

```typescript
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { AppModule } from './app.module';

const server = express();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  await app.init();
}

bootstrap();

export const handler = server;
```
