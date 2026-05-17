# AWS EventBridge

Amazon EventBridge integration for event-driven architectures in NestJS.

## Documentation

- [AWS EventBridge User Guide](https://docs.aws.amazon.com/eventbridge/latest/userguide/)
- [@aws-sdk/client-eventbridge on npm](https://www.npmjs.com/package/@aws-sdk/client-eventbridge)
- [NestJS CQRS — Events](https://docs.nestjs.com/recipes/cqrs)

## Dependencies

| Package                       | Version   | Purpose                       |
| ----------------------------- | --------- | ----------------------------- |
| `@aws-sdk/client-eventbridge` | `3.712.0` | AWS SDK v3 EventBridge client |

## Environment Variables

| Variable               | Default     | Description          |
| ---------------------- | ----------- | -------------------- |
| `AWS_REGION`           | `eu-west-1` | AWS region           |
| `EVENTBRIDGE_BUS_NAME` | `default`   | EventBridge bus name |

## Usage

```typescript
import { EventBridgeService } from '@/aws/eventbridge.service';

@Injectable()
export class DomainEventPublisher {
  constructor(private readonly eventBridge: EventBridgeService) {}

  async publishEvent(detailType: string, detail: Record<string, unknown>): Promise<void> {
    await this.eventBridge.putEvents({
      Entries: [
        {
          Source: 'com.myapp.orders',
          DetailType: detailType,
          Detail: JSON.stringify(detail),
          EventBusName: this.configService.get('EVENTBRIDGE_BUS_NAME'),
        },
      ],
    });
  }
}
```
