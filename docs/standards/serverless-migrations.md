# Serverless Database Migrations

## Overview

Database migrations in serverless environments require a different approach than traditional long-running servers. Migrations cannot rely on application startup hooks because Lambda functions are ephemeral and may run multiple instances concurrently. Instead, migrations must run as a **dedicated, isolated step** in the deployment pipeline — before application code is deployed.

### Problem Statement

- **No persistent process**: Lambda functions cold-start and terminate; there is no reliable "application boot" phase to run migrations.
- **Concurrency risk**: Multiple Lambda instances starting simultaneously could attempt the same migration, causing conflicts or partial applies.
- **Rollback complexity**: A failed migration that has already altered the schema leaves the application in an inconsistent state if new code is deployed on top.

### Solution

Run migrations via a **dedicated migration-runner Lambda** invoked synchronously by the CI/CD pipeline. The pipeline inspects the Lambda's JSON response and only proceeds to deploy application Lambdas if `success: true`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CI/CD Pipeline                         │
│                                                             │
│  ┌──────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Build   │───>│ Deploy Migration │───>│ Deploy App    │  │
│  │  & Test  │    │ Runner Lambda    │    │ Lambdas       │  │
│  └──────────┘    └────────┬─────────┘    └───────────────┘  │
│                           │                     ▲           │
│                    invoke │                     │           │
│                           ▼               only if           │
│                  ┌────────────────┐      success: true      │
│                  │ Migration      │─────────────┘           │
│                  │ Runner Lambda  │                         │
│                  └────────┬───────┘                         │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   PostgreSQL    │
                   │   (in VPC)      │
                   └─────────────────┘
```

## Deployment Order Guarantee

1. **Build & test** — compile, lint, unit tests
2. **Deploy migration-runner Lambda** — upload new bundle with latest migration files
3. **Invoke migration-runner Lambda** — run pending migrations
4. **Validate response** — assert `success: true` in the JSON payload
5. **Deploy application Lambdas** — only if step 4 passed

If step 4 fails, the pipeline stops. Application code is never deployed against an inconsistent schema.

## Response Contract

### Success

```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "migrationsRun": 2,
    "migrations": ["1700000000000-CreateUsersTable", "1700000000001-AddEmailIndex"]
  }
}
```

### Failure

```json
{
  "statusCode": 500,
  "body": {
    "success": false,
    "error": "relation \"users\" already exists"
  }
}
```

### Zero Migrations Pending

```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "migrationsRun": 0,
    "migrations": []
  }
}
```

## Lambda Handler Structure (ORM-Agnostic)

Every migration-runner Lambda follows this pattern regardless of ORM:

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('MigrationRunner');

export const handler = async () => {
  let connection: unknown;

  try {
    const dbPassword = await fetchSecret(process.env.DB_PASSWORD_SECRET_ARN);
    connection = await initializeOrm(dbPassword);
    const result = await runMigrations(connection);

    logger.log(`Migrations completed: ${result.count} run`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        migrationsRun: result.count,
        migrations: result.names,
      }),
    };
  } catch (error) {
    logger.error('Migration failed', error instanceof Error ? error.stack : String(error));

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  } finally {
    await destroyConnection(connection);
  }
};
```

## ORM-Specific Implementations

### TypeORM (Primary)

TypeORM is the primary ORM in this boilerplate. The full implementation is provided as a recipe template.

#### Migrations Barrel File

esbuild (used to bundle Lambda code) cannot resolve glob patterns or `fs.readdirSync` at build time. All migrations must be explicitly imported in a barrel file:

```typescript
// src/infrastructure/database/migrations/index.ts
import type { MigrationInterface } from 'typeorm';

import { CreateUsersTable1700000000000 } from './1700000000000-CreateUsersTable';
import { AddEmailIndex1700000000001 } from './1700000000001-AddEmailIndex';

export const migrations: (new () => MigrationInterface)[] = [
  CreateUsersTable1700000000000,
  AddEmailIndex1700000000001,
];
```

#### DataSource Configuration

The Lambda handler creates a `DataSource` with explicit entity and migration arrays:

```typescript
import { DataSource } from 'typeorm';
import { entities } from '../../infrastructure/database/entities/index.js';
import { migrations } from '../../infrastructure/database/migrations/index.js';

const dataSource = new DataSource({
  type: 'postgres',
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  username: DB_USERNAME,
  password: dbPassword,
  entities,
  migrations,
  synchronize: false,
  migrationsTableName: 'typeorm_migrations',
});

await dataSource.initialize();
const executed = await dataSource.runMigrations({ transaction: 'each' });
await dataSource.destroy();
```

#### CLI Data Source (Local Development)

A separate `data-source.ts` file uses glob patterns for local CLI usage:

```typescript
// src/infrastructure/database/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'myapp',
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  entities: ['src/infrastructure/database/entities/**/*.ts'],
  migrations: ['src/infrastructure/database/migrations/*.ts'],
  synchronize: false,
});
```

This file is used by the TypeORM CLI for `migration:generate`, `migration:run`, and `migration:revert` commands during local development.

### Drizzle (Sketch)

Drizzle uses a file-based migrator that reads SQL files from a directory. For Lambda, bundle the migration SQL files into the deployment artifact.

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

const client = new Client({ connectionString });
await client.connect();

const db = drizzle(client);
await migrate(db, { migrationsFolder: './migrations' });

await client.end();
```

**Key difference**: Drizzle migrations are SQL files, not TypeScript classes. The migration folder must be included in the Lambda bundle (e.g., via esbuild's `copy` plugin or a post-build step).

### Prisma (Sketch)

Prisma uses its own migration engine. For Lambda, use `prisma migrate deploy`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Prisma CLI must be available in the Lambda bundle
const { stdout, stderr } = await execAsync('npx prisma migrate deploy');
```

**Key difference**: Prisma requires the Prisma CLI binary in the Lambda bundle, which increases the deployment artifact size. Consider using a container-based Lambda for Prisma migrations.

## ORM Comparison

| Aspect              | TypeORM                      | Drizzle                   | Prisma                       |
| ------------------- | ---------------------------- | ------------------------- | ---------------------------- |
| Migration format    | TypeScript classes           | SQL files                 | SQL files + Prisma schema    |
| Lambda bundling     | Barrel file import           | Copy SQL folder           | Include Prisma CLI binary    |
| Transaction control | `transaction: 'each'`        | Per-file by default       | Per-migration by default     |
| Programmatic API    | `dataSource.runMigrations()` | `migrate(db, { folder })` | CLI-based (`prisma migrate`) |
| Bundle size impact  | Minimal                      | Minimal                   | Large (Prisma engine ~15 MB) |
| NestJS integration  | `@nestjs/typeorm` module     | Manual provider           | `@nestjs/prisma` (community) |

## Pipeline Integration

### GitHub Actions

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build & test
        run: pnpm install && pnpm build && pnpm test

      - name: Deploy migration Lambda
        run: |
          aws lambda update-function-code \
            --function-name ${{ vars.MIGRATION_LAMBDA_NAME }} \
            --zip-file fileb://dist/migration-runner.zip

      - name: Run migrations
        id: migrate
        run: |
          RESPONSE=$(aws lambda invoke \
            --function-name ${{ vars.MIGRATION_LAMBDA_NAME }} \
            --payload '{}' \
            --cli-binary-format raw-in-base64-out \
            /dev/stdout 2>/dev/null)
          echo "response=$RESPONSE" >> "$GITHUB_OUTPUT"

          SUCCESS=$(echo "$RESPONSE" | jq -r '.body | fromjson | .success')
          if [ "$SUCCESS" != "true" ]; then
            echo "Migration failed:"
            echo "$RESPONSE" | jq '.body | fromjson'
            exit 1
          fi

      - name: Deploy application Lambdas
        if: steps.migrate.outcome == 'success'
        run: |
          # Deploy application Lambda functions
          aws lambda update-function-code \
            --function-name ${{ vars.APP_LAMBDA_NAME }} \
            --zip-file fileb://dist/app.zip
```

### Azure DevOps

```yaml
stages:
  - stage: Migrate
    jobs:
      - job: RunMigrations
        steps:
          - task: AWSShellScript@1
            displayName: Deploy & invoke migration Lambda
            inputs:
              awsCredentials: 'aws-service-connection'
              scriptType: inline
              inlineScript: |
                aws lambda update-function-code \
                  --function-name $(MIGRATION_LAMBDA_NAME) \
                  --zip-file fileb://dist/migration-runner.zip

                RESPONSE=$(aws lambda invoke \
                  --function-name $(MIGRATION_LAMBDA_NAME) \
                  --payload '{}' \
                  --cli-binary-format raw-in-base64-out \
                  /dev/stdout 2>/dev/null)

                SUCCESS=$(echo "$RESPONSE" | jq -r '.body | fromjson | .success')
                if [ "$SUCCESS" != "true" ]; then
                  echo "##vso[task.logissue type=error]Migration failed"
                  echo "$RESPONSE" | jq '.body | fromjson'
                  exit 1
                fi

  - stage: Deploy
    dependsOn: Migrate
    condition: succeeded()
    jobs:
      - job: DeployApp
        steps:
          - script: echo "Deploy application Lambdas"
```

### AWS CodePipeline

For AWS CodePipeline, use a CodeBuild step that invokes the migration Lambda and validates the response. The same shell logic applies — invoke the Lambda, parse the JSON response, and fail the build if `success` is not `true`.

## Terraform Infrastructure

```hcl
# Migration-runner Lambda
resource "aws_lambda_function" "migration_runner" {
  function_name = "${var.project_name}-migration-runner-${var.environment}"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 256

  filename         = var.migration_runner_zip_path
  source_code_hash = filebase64sha256(var.migration_runner_zip_path)

  role = aws_iam_role.migration_runner.arn

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.migration_runner.id]
  }

  environment {
    variables = {
      DB_HOST               = var.db_host
      DB_PORT               = tostring(var.db_port)
      DB_NAME               = var.db_name
      DB_USERNAME           = var.db_username
      DB_PASSWORD_SECRET_ARN = var.db_password_secret_arn
    }
  }
}

# IAM role for Secrets Manager access
resource "aws_iam_role_policy" "migration_runner_secrets" {
  name = "${var.project_name}-migration-runner-secrets"
  role = aws_iam_role.migration_runner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [var.db_password_secret_arn]
      }
    ]
  })
}

# Security group allowing egress to RDS
resource "aws_security_group" "migration_runner" {
  name_prefix = "${var.project_name}-migration-runner-"
  vpc_id      = var.vpc_id

  egress {
    from_port       = var.db_port
    to_port         = var.db_port
    protocol        = "tcp"
    security_groups = [var.db_security_group_id]
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for Secrets Manager VPC endpoint or NAT"
  }
}
```

## Environment Variables

| Variable                 | Required | Default     | Description                                 |
| ------------------------ | -------- | ----------- | ------------------------------------------- |
| `DB_HOST`                | Yes      | `localhost` | PostgreSQL hostname                         |
| `DB_PORT`                | No       | `5432`      | PostgreSQL port                             |
| `DB_NAME`                | Yes      | —           | Database name                               |
| `DB_USERNAME`            | Yes      | `postgres`  | Database user                               |
| `DB_PASSWORD_SECRET_ARN` | Yes      | —           | AWS Secrets Manager ARN for the DB password |

## Safety Guarantees

1. **Transaction isolation**: Each migration runs in its own transaction (`transaction: 'each'` in TypeORM). A failing migration rolls back only itself; previously successful migrations remain applied.
2. **Idempotency**: The migration table tracks which migrations have run. Re-invoking the Lambda is safe — already-applied migrations are skipped.
3. **No concurrent execution**: The pipeline invokes the Lambda synchronously and waits for the response. There is no parallel invocation risk from the pipeline side.
4. **No auto-sync**: `synchronize: false` is always set. Schema changes only happen through explicit migrations.
5. **Secrets never in environment**: The database password is fetched at runtime from AWS Secrets Manager, never stored as a plaintext environment variable.

## Monitoring

### CloudWatch Alarms

- **Lambda errors**: Alert on any invocation error (the pipeline already fails, but alarms catch manual invocations).
- **Duration**: Alert if migration takes longer than expected (potential long-running DDL lock).
- **Secrets Manager throttling**: Alert on `ThrottlingException` from Secrets Manager.

### Structured Logging

The migration-runner Lambda logs structured output via NestJS `Logger`:

```
[MigrationRunner] Migration runner started
[MigrationRunner] DataSource initialized
[MigrationRunner] Migrations completed: 2 run
[MigrationRunner] DataSource destroyed
```

## Adapting for a New Project (Checklist)

- [ ] Copy the `migration-runner` Lambda template from the typeorm-postgres recipe
- [ ] Configure environment variables in Terraform (or your IaC tool)
- [ ] Place the Lambda in the same VPC as the database
- [ ] Grant Secrets Manager read access to the Lambda's IAM role
- [ ] Add a CI/CD pipeline step to deploy and invoke the migration Lambda
- [ ] Validate the JSON response (`success: true`) before deploying application code
- [ ] Set up CloudWatch alarms for Lambda errors and duration
- [ ] Add new migrations to the barrel file (`migrations/index.ts`) after generating them
- [ ] Test the full flow in a staging environment before production
