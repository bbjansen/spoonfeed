# Deployment Recipes

Packaging and deploying NestJS applications to various targets.

## Available Recipes

| Recipe | Target                                                        | Recipe README                                               |
| ------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Deploy | Dockerfile, docker-compose, Kubernetes, Serverless, Terraform | [deploy](../../packages/templates/recipes/deploy/README.md) |

## Dockerfile

Multi-stage build for minimal production images.

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
```

**Best practices**: use `.dockerignore`, run as non-root user, use `--frozen-lockfile`, keep image under 200MB.

## Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - '3000:3000'
    env_file: .env
    depends_on:
      - postgres
      - redis
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
volumes:
  pgdata:
```

## Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: registry.example.com/api:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          envFrom:
            - secretRef:
                name: api-secrets
```

**Best practices**: set resource limits, use probes, run multiple replicas, use `envFrom` for secrets.

## Serverless Framework

```yaml
# serverless.yml
service: my-api
provider:
  name: aws
  runtime: nodejs20.x
  region: eu-west-1
functions:
  api:
    handler: dist/serverless.handler
    events:
      - http:
          method: ANY
          path: /{proxy+}
```

```typescript
// serverless.ts
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@codegenie/serverless-express';

let cachedServer;

export const handler = async (event, context) => {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule, new ExpressAdapter());
    await app.init();
    cachedServer = serverlessExpress({ app: app.getHttpAdapter().getInstance() });
  }
  return cachedServer(event, context);
};
```

## Terraform

```hcl
resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 3
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.api.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }
}
```

**Best practices**: use remote state, separate environments with workspaces or directories, tag all resources.

## External Documentation

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Serverless Framework](https://www.serverless.com/framework/docs)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
