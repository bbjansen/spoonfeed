# AWS SQS

Amazon Simple Queue Service integration for reliable message queuing in NestJS.

## Documentation

- [AWS SQS Developer Guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/)
- [@aws-sdk/client-sqs on npm](https://www.npmjs.com/package/@aws-sdk/client-sqs)
- [NestJS Microservices — Custom Transporters](https://docs.nestjs.com/microservices/custom-transport)

## Dependencies

| Package               | Version   | Purpose               |
| --------------------- | --------- | --------------------- |
| `@aws-sdk/client-sqs` | `3.712.0` | AWS SDK v3 SQS client |

## Environment Variables

| Variable        | Default     | Description   |
| --------------- | ----------- | ------------- |
| `AWS_REGION`    | `eu-west-1` | AWS region    |
| `SQS_QUEUE_URL` | —           | SQS queue URL |

## Usage

```typescript
import { SqsService } from '@/aws/sqs.service';

@Injectable()
export class OrderProcessor {
  constructor(private readonly sqs: SqsService) {}

  async enqueue(order: Order): Promise<void> {
    await this.sqs.sendMessage({
      QueueUrl: this.configService.get('SQS_QUEUE_URL'),
      MessageBody: JSON.stringify(order),
    });
  }

  async poll(): Promise<Order[]> {
    const response = await this.sqs.receiveMessages({
      QueueUrl: this.configService.get('SQS_QUEUE_URL'),
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
    });
    return (response.Messages ?? []).map((m) => JSON.parse(m.Body));
  }
}
```
