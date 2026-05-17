# GCP Pub/Sub

Google Cloud Pub/Sub messaging integration for NestJS.

## Documentation

- [GCP Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [@google-cloud/pubsub on npm](https://www.npmjs.com/package/@google-cloud/pubsub)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)

## Dependencies

| Package                | Version | Purpose                     |
| ---------------------- | ------- | --------------------------- |
| `@google-cloud/pubsub` | `4.9.0` | Google Cloud Pub/Sub client |

## Environment Variables

| Variable              | Default | Description               |
| --------------------- | ------- | ------------------------- |
| `GCP_PROJECT_ID`      | —       | GCP project ID            |
| `PUBSUB_TOPIC`        | —       | Pub/Sub topic name        |
| `PUBSUB_SUBSCRIPTION` | —       | Pub/Sub subscription name |

## Usage

```typescript
import { PubSubService } from '@/gcp/pubsub.service';

@Injectable()
export class EventPublisher {
  constructor(private readonly pubsub: PubSubService) {}

  async publish(event: DomainEvent): Promise<string> {
    const messageId = await this.pubsub.publishMessage(
      this.configService.get('PUBSUB_TOPIC'),
      JSON.stringify(event),
      { eventType: event.type },
    );
    return messageId;
  }
}
```
