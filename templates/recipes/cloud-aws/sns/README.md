# AWS SNS

Amazon Simple Notification Service integration for pub/sub messaging in NestJS.

## Documentation

- [AWS SNS Developer Guide](https://docs.aws.amazon.com/sns/latest/dg/)
- [@aws-sdk/client-sns on npm](https://www.npmjs.com/package/@aws-sdk/client-sns)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)

## Dependencies

| Package               | Version   | Purpose               |
| --------------------- | --------- | --------------------- |
| `@aws-sdk/client-sns` | `3.712.0` | AWS SDK v3 SNS client |

## Environment Variables

| Variable        | Default     | Description   |
| --------------- | ----------- | ------------- |
| `AWS_REGION`    | `eu-west-1` | AWS region    |
| `SNS_TOPIC_ARN` | —           | SNS topic ARN |

## Usage

```typescript
import { SnsService } from '@/aws/sns.service';

@Injectable()
export class NotificationPublisher {
  constructor(private readonly sns: SnsService) {}

  async publishOrderCreated(order: Order): Promise<void> {
    await this.sns.publish({
      TopicArn: this.configService.get('SNS_TOPIC_ARN'),
      Message: JSON.stringify(order),
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'ORDER_CREATED' },
      },
    });
  }
}
```
