# AWS Lambda Project Type

## When to Use

Choose `aws-lambda` when you need serverless functions that respond to AWS events (API Gateway, SQS, S3, EventBridge). Best for workloads with variable traffic, event-driven processing, or when you want to avoid managing infrastructure.

Not ideal for long-running processes (15-minute max), WebSocket connections, or workloads requiring persistent local state.

## Lambda Handler Architecture

NestJS runs inside a Lambda handler using `@nestjs/platform-express` or `@codegenie/serverless-adapter`. The application bootstraps once per cold start and reuses the instance across warm invocations.

```
src/
  app/
    handlers/
      api.handler.ts          # API Gateway handler
      sqs.handler.ts           # SQS event handler
      scheduled.handler.ts     # EventBridge scheduled handler
    features/
      orders/
        order.controller.ts
        order.service.ts
        order.module.ts
  config/
    app.config.ts
  app.module.ts
  main.ts                      # Local dev entry point
serverless.yml                 # Serverless Framework config
```

### API Gateway Handler

```typescript
import { NestFactory } from '@nestjs/core';
import { configure } from '@codegenie/serverless-adapter';
import { AppModule } from '@/app.module';

let cachedApp;

async function bootstrap() {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);
    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

export const handler = configure({
  app: bootstrap,
});
```

### SQS Event Handler

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { OrderProcessor } from '@/features/orders/order.processor';
import { SQSEvent } from 'aws-lambda';

let processor: OrderProcessor;

export async function handler(event: SQSEvent) {
  if (!processor) {
    const app = await NestFactory.createApplicationContext(AppModule);
    processor = app.get(OrderProcessor);
  }

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    await processor.process(body);
  }
}
```

## Cold Start Considerations

| Factor                  | Impact     | Mitigation                             |
| ----------------------- | ---------- | -------------------------------------- |
| Bundle size             | High       | Tree-shake, use `@swc/core` compiler   |
| Dependency count        | High       | Minimize imports, lazy-load modules    |
| NestJS bootstrap        | Medium     | Cache app instance outside handler     |
| Database connections    | Medium     | Use RDS Proxy or connection pooling    |
| VPC attachment          | High       | Use VPC endpoints, avoid unless needed |
| Provisioned concurrency | Eliminates | Set for latency-sensitive functions    |

### Bundle Optimization

```yaml
# serverless.yml
package:
  individually: true
  patterns:
    - '!node_modules/**'
    - '!src/**'
    - '!test/**'
    - 'dist/**'
```

Use `esbuild` or `swc` to produce a single-file bundle:

```bash
pnpm build:lambda   # Outputs optimized dist/handler.js
```

## Deployment with Serverless Framework

### Configuration

```yaml
# serverless.yml
service: order-service

provider:
  name: aws
  runtime: nodejs20.x
  region: eu-west-1
  memorySize: 512
  timeout: 30
  environment:
    NODE_ENV: production
    DB_HOST: ${ssm:/order-service/db-host}

functions:
  api:
    handler: dist/handlers/api.handler
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY

  processOrders:
    handler: dist/handlers/sqs.handler
    events:
      - sqs:
          arn: !GetAtt OrderQueue.Arn
          batchSize: 10
```

### Deploy Commands

```bash
# Deploy to dev
pnpm sls deploy --stage dev

# Deploy single function
pnpm sls deploy function -f api --stage dev

# View logs
pnpm sls logs -f api --stage dev --tail

# Remove stack
pnpm sls remove --stage dev
```

## Testing Lambda Handlers Locally

### Invoke Locally with Serverless

```bash
# Invoke with event file
pnpm sls invoke local -f api -p events/get-order.json

# Invoke SQS handler
pnpm sls invoke local -f processOrders -p events/sqs-event.json
```

### Event File Examples

```json
// events/get-order.json
{
  "httpMethod": "GET",
  "path": "/orders/123",
  "headers": { "Content-Type": "application/json" }
}
```

### Unit Testing Handlers

```typescript
import { Test } from '@nestjs/testing';
import { OrderProcessor } from '@/features/orders/order.processor';

describe('SQS Handler', () => {
  let processor: OrderProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrderProcessor],
    }).compile();

    processor = module.get(OrderProcessor);
  });

  it('should process order message', async () => {
    const result = await processor.process({
      orderId: '123',
      action: 'create',
    });

    expect(result.status).toBe('processed');
  });
});
```

### Local API with Serverless Offline

```bash
pnpm sls offline start --stage local
# API available at http://localhost:3000
```
