# AWS Cloud Recipes

AWS service integrations for NestJS applications. All recipes use the AWS SDK v3.

## Available Recipes

| #   | Service         | Description                                         | AWS Docs                                                                                                      | SDK Package                                                                                                          |
| --- | --------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | S3              | Object storage for files, media, and backups        | [S3 Docs](https://docs.aws.amazon.com/s3/)                                                                    | [@aws-sdk/client-s3](https://www.npmjs.com/package/@aws-sdk/client-s3)                                               |
| 2   | SQS             | Managed message queue for async processing          | [SQS Docs](https://docs.aws.amazon.com/sqs/)                                                                  | [@aws-sdk/client-sqs](https://www.npmjs.com/package/@aws-sdk/client-sqs)                                             |
| 3   | SNS             | Pub/sub messaging and push notifications            | [SNS Docs](https://docs.aws.amazon.com/sns/)                                                                  | [@aws-sdk/client-sns](https://www.npmjs.com/package/@aws-sdk/client-sns)                                             |
| 4   | DynamoDB        | Serverless NoSQL database                           | [DynamoDB Docs](https://docs.aws.amazon.com/dynamodb/)                                                        | [@aws-sdk/client-dynamodb](https://www.npmjs.com/package/@aws-sdk/client-dynamodb)                                   |
| 5   | SES             | Transactional and bulk email sending                | [SES Docs](https://docs.aws.amazon.com/ses/)                                                                  | [@aws-sdk/client-ses](https://www.npmjs.com/package/@aws-sdk/client-ses)                                             |
| 6   | Cognito         | User authentication and authorization               | [Cognito Docs](https://docs.aws.amazon.com/cognito/)                                                          | [@aws-sdk/client-cognito-identity-provider](https://www.npmjs.com/package/@aws-sdk/client-cognito-identity-provider) |
| 7   | Secrets Manager | Secure storage for API keys and credentials         | [Secrets Manager Docs](https://docs.aws.amazon.com/secretsmanager/)                                           | [@aws-sdk/client-secrets-manager](https://www.npmjs.com/package/@aws-sdk/client-secrets-manager)                     |
| 8   | Parameter Store | Hierarchical configuration management               | [SSM Docs](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html) | [@aws-sdk/client-ssm](https://www.npmjs.com/package/@aws-sdk/client-ssm)                                             |
| 9   | CloudWatch      | Log aggregation and custom metrics                  | [CloudWatch Docs](https://docs.aws.amazon.com/cloudwatch/)                                                    | [@aws-sdk/client-cloudwatch](https://www.npmjs.com/package/@aws-sdk/client-cloudwatch)                               |
| 10  | EventBridge     | Serverless event bus for event-driven architectures | [EventBridge Docs](https://docs.aws.amazon.com/eventbridge/)                                                  | [@aws-sdk/client-eventbridge](https://www.npmjs.com/package/@aws-sdk/client-eventbridge)                             |
| 11  | Lambda          | Invoke or deploy as serverless functions            | [Lambda Docs](https://docs.aws.amazon.com/lambda/)                                                            | [@aws-sdk/client-lambda](https://www.npmjs.com/package/@aws-sdk/client-lambda)                                       |
| 12  | X-Ray           | Distributed tracing and service map                 | [X-Ray Docs](https://docs.aws.amazon.com/xray/)                                                               | [aws-xray-sdk](https://www.npmjs.com/package/aws-xray-sdk)                                                           |

## Authentication

All AWS SDK v3 clients follow the default credential provider chain:

1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. Shared credentials file (`~/.aws/credentials`)
3. ECS container credentials
4. EC2 instance metadata (IAM role)

```typescript
import { S3Client } from '@aws-sdk/client-s3';

// Credentials resolved automatically via provider chain
const s3 = new S3Client({ region: process.env.AWS_REGION });
```

## Local Development

Use [LocalStack](https://localstack.cloud) to emulate AWS services locally:

```yaml
# docker-compose.yml
localstack:
  image: localstack/localstack
  ports:
    - '4566:4566'
  environment:
    SERVICES: s3,sqs,sns,dynamodb,ses,secretsmanager,ssm
```

```typescript
// point SDK to LocalStack
const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  forcePathStyle: true,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
```

## External Documentation

- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [LocalStack Documentation](https://docs.localstack.cloud)

## Related Recipes

- [S3/MinIO Storage](storage.md) -- detailed file storage patterns
- [Deployment](deployment.md) -- deploying to AWS with ECS, Lambda, or EKS
