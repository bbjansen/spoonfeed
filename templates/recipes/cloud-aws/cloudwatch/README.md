# AWS CloudWatch Logs

Ship application logs to AWS CloudWatch Logs from NestJS.

## Documentation

- [AWS CloudWatch Logs User Guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [@aws-sdk/client-cloudwatch-logs on npm](https://www.npmjs.com/package/@aws-sdk/client-cloudwatch-logs)
- [NestJS Logger](https://docs.nestjs.com/techniques/logger)

## Dependencies

| Package                           | Version   | Purpose                           |
| --------------------------------- | --------- | --------------------------------- |
| `@aws-sdk/client-cloudwatch-logs` | `3.712.0` | AWS SDK v3 CloudWatch Logs client |

## Environment Variables

| Variable               | Default       | Description               |
| ---------------------- | ------------- | ------------------------- |
| `AWS_REGION`           | `eu-west-1`   | AWS region                |
| `CLOUDWATCH_LOG_GROUP` | `/app/nestjs` | CloudWatch log group name |

## Usage

```typescript
import { CloudWatchLoggerService } from '@/aws/cloudwatch-logger.service';

@Injectable()
export class AppLogger {
  constructor(private readonly cwLogger: CloudWatchLoggerService) {}

  async info(message: string, context: Record<string, unknown>): Promise<void> {
    await this.cwLogger.log({
      logGroupName: this.configService.get('CLOUDWATCH_LOG_GROUP'),
      message: JSON.stringify({ level: 'info', message, ...context }),
    });
  }
}
```
