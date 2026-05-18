# Cloud — AWS Recipes

spoonfeed provides 12 AWS recipes covering messaging, storage, databases, authentication, secrets, logging, caching, and CDN. Use these recipes when deploying to AWS infrastructure. Each recipe wraps an official `@aws-sdk/*` v3 client behind a NestJS injectable service with structured logging built in.

All AWS recipes use the official `@aws-sdk/*` v3 packages with exact version pinning.

!!! tip "Recommended combinations"
    - **Typical API on AWS:** `aws-s3` + `aws-secrets-manager` + `aws-cloudwatch` + `aws-rds`
    - **Event-driven architecture:** `aws-sqs` + `aws-sns` + `aws-eventbridge`
    - **Managed auth + caching:** `aws-cognito` + `aws-elasticache`

!!! note "IAM credentials"
    All AWS recipes rely on the standard AWS credential chain (environment variables, instance profile, SSO). Set `AWS_REGION` at a minimum. Avoid hardcoding credentials — use IAM roles in production.

---

## AWS SQS

Amazon Simple Queue Service integration for message queuing.

| | |
| --- | --- |
| **ID** | `aws-sqs` |
| **Dependencies** | `@aws-sdk/client-sqs` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `SQS_QUEUE_URL` | | SQS queue URL |

**Usage:** Use `SqsService` to send and receive messages. Use long polling for efficient retrieval. Handle message deletion after successful processing and configure dead-letter queues for failures.

```typescript
import { Injectable } from '@nestjs/common';
import { SqsService } from '@/infrastructure/aws/sqs.service';

@Injectable()
export class OrderProcessor {
  constructor(private readonly sqs: SqsService) {}

  async enqueueOrder(orderId: string): Promise<void> {
    await this.sqs.sendMessage(
      process.env.SQS_QUEUE_URL!,
      JSON.stringify({ orderId, action: 'process' }),
    );
  }

  async pollOrders(): Promise<void> {
    const messages = await this.sqs.receiveMessages(
      process.env.SQS_QUEUE_URL!,
      10,
      20,
    );
    for (const msg of messages) {
      // process, then delete
      await this.sqs.deleteMessage(
        process.env.SQS_QUEUE_URL!,
        msg.ReceiptHandle!,
      );
    }
  }
}
```

!!! warning "Requires an AWS account"
    SQS is a managed AWS service. For local development, use [ElasticMQ](https://github.com/softwaremill/elasticmq) or [LocalStack](https://localstack.cloud/).

**Pairs well with:** `aws-sns` (fan-out), `dead-letter-queue`, `transactional-outbox`

---

## AWS SNS

Amazon Simple Notification Service for pub/sub messaging.

| | |
| --- | --- |
| **ID** | `aws-sns` |
| **Dependencies** | `@aws-sdk/client-sns` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `SNS_TOPIC_ARN` | | SNS topic ARN |

**Usage:** Use `SnsService` to publish messages. Subscribe SQS queues, Lambda functions, or HTTP endpoints to topics. Use message attributes for subscriber filtering.

---

## AWS EventBridge

Amazon EventBridge for event-driven architectures.

| | |
| --- | --- |
| **ID** | `aws-eventbridge` |
| **Dependencies** | `@aws-sdk/client-eventbridge` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `EVENTBRIDGE_BUS_NAME` | `default` | EventBridge bus name |

**Usage:** Use `EventBridgeService` to put events on the bus. Define event rules and targets in infrastructure-as-code (Terraform/CDK), not application code.

---

## AWS S3

Amazon S3 object storage for file uploads and downloads.

| | |
| --- | --- |
| **ID** | `aws-s3` |
| **Dependencies** | `@aws-sdk/client-s3` `@aws-sdk/s3-request-presigner` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `S3_BUCKET` | `my-bucket` | S3 bucket name |

**Usage:** Use `S3Service` for uploads, downloads, and presigned URLs. Use presigned URLs for client-side uploads to avoid routing large files through your API.

```typescript
import { Controller, Post, Get, Param } from '@nestjs/common';
import { S3Service } from '@/infrastructure/aws/s3.service';

@Controller('files')
export class FileController {
  constructor(private readonly s3: S3Service) {}

  @Get(':key/download-url')
  async getDownloadUrl(@Param('key') key: string) {
    const url = await this.s3.getPresignedUrl('my-bucket', key, 900);
    return { url };
  }
}
```

!!! warning "Requires an AWS account"
    S3 is a managed AWS service. For local development, use [MinIO](https://min.io/) or [LocalStack](https://localstack.cloud/).

**Pairs well with:** `aws-cloudfront` (CDN for S3 objects), `file-upload`

---

## AWS Cognito

AWS Cognito user pool authentication and authorization.

| | |
| --- | --- |
| **ID** | `aws-cognito` |
| **Dependencies** | `@aws-sdk/client-cognito-identity-provider` `aws-jwt-verify` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `COGNITO_USER_POOL_ID` | | Cognito user pool ID |
| `COGNITO_CLIENT_ID` | | Cognito app client ID |

**Usage:** Apply `CognitoAuthGuard` to validate Cognito JWT tokens on protected routes. Use Cognito groups for RBAC.

---

## AWS Secrets Manager

Retrieve and cache secrets from AWS Secrets Manager.

| | |
| --- | --- |
| **ID** | `aws-secrets-manager` |
| **Dependencies** | `@aws-sdk/client-secrets-manager` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |

**Usage:** Use `SecretsService` to fetch secrets at startup. Secrets are cached to reduce API calls. Rotation is handled by AWS — the app reads the latest version automatically.

---

## AWS SSM Parameter Store

Retrieve configuration from AWS Systems Manager Parameter Store.

| | |
| --- | --- |
| **ID** | `aws-ssm` |
| **Dependencies** | `@aws-sdk/client-ssm` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `SSM_PREFIX` | `/app/prod` | SSM parameter path prefix |

**Usage:** Use `SsmService` to load parameters by path prefix at bootstrap. Use `SecureString` type for sensitive values.

---

## AWS RDS

AWS RDS connection with IAM authentication support via TypeORM.

| | |
| --- | --- |
| **ID** | `aws-rds` |
| **Dependencies** | `@nestjs/typeorm` `typeorm` `pg` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `RDS_HOST` | | RDS instance endpoint |
| `RDS_PORT` | `5432` | RDS port |
| `RDS_DATABASE` | `app` | RDS database name |
| `RDS_USERNAME` | `postgres` | RDS username |
| `RDS_PASSWORD` | | RDS password |

**Usage:** TypeORM connects to RDS PostgreSQL. Use IAM database authentication in production for passwordless access. Enable SSL and consider RDS Proxy for Lambda deployments.

---

## AWS DynamoDB

Amazon DynamoDB NoSQL database integration.

| | |
| --- | --- |
| **ID** | `aws-dynamodb` |
| **Dependencies** | `@aws-sdk/client-dynamodb` `@aws-sdk/lib-dynamodb` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `DYNAMODB_TABLE_NAME` | `app-table` | DynamoDB table name |

**Usage:** Use `DynamoDbService` with the Document Client (`lib-dynamodb`) for simplified marshalling. Design access patterns first, then model tables. Prefer `Query` over `Scan`.

---

## AWS ElastiCache

AWS ElastiCache (Redis) for managed caching.

| | |
| --- | --- |
| **ID** | `aws-elasticache` |
| **Dependencies** | `ioredis` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `ELASTICACHE_ENDPOINT` | | ElastiCache primary endpoint |
| `ELASTICACHE_PORT` | `6379` | ElastiCache port |

**Usage:** Connect via `ioredis`. Enable TLS for in-transit encryption. Use Redis cluster mode for high availability.

---

## AWS CloudWatch Logs

Ship application logs to AWS CloudWatch Logs.

| | |
| --- | --- |
| **ID** | `aws-cloudwatch` |
| **Dependencies** | `@aws-sdk/client-cloudwatch-logs` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | AWS region |
| `CLOUDWATCH_LOG_GROUP` | `/app/nestjs` | CloudWatch log group name |

**Usage:** Structured JSON logs are shipped to CloudWatch. Use CloudWatch Insights for querying.

---

## AWS CloudFront

AWS CloudFront CDN integration with signed URLs.

| | |
| --- | --- |
| **ID** | `aws-cloudfront` |
| **Dependencies** | `@aws-sdk/client-cloudfront` `@aws-sdk/cloudfront-signer` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `CLOUDFRONT_KEY_PAIR_ID` | | CloudFront key pair ID for signed URLs |
| `CLOUDFRONT_PRIVATE_KEY` | | CloudFront private key for signed URLs |

**Usage:** Use `CloudFrontService` to generate signed URLs for private content and invalidate caches. Use versioned paths instead of cache invalidation where possible.

**Pairs well with:** `aws-s3`
