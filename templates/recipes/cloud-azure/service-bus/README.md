# Azure Service Bus

Azure Service Bus for enterprise messaging in NestJS.

## Documentation

- [Azure Service Bus Documentation](https://learn.microsoft.com/en-us/azure/service-bus-messaging/)
- [@azure/service-bus on npm](https://www.npmjs.com/package/@azure/service-bus)
- [@azure/identity on npm](https://www.npmjs.com/package/@azure/identity)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)

## Dependencies

| Package              | Version | Purpose                           |
| -------------------- | ------- | --------------------------------- |
| `@azure/service-bus` | `7.9.5` | Azure Service Bus client          |
| `@azure/identity`    | `4.5.0` | Azure identity and authentication |

## Environment Variables

| Variable                             | Default | Description                   |
| ------------------------------------ | ------- | ----------------------------- |
| `AZURE_SERVICEBUS_CONNECTION_STRING` | —       | Service Bus connection string |
| `AZURE_SERVICEBUS_QUEUE`             | —       | Service Bus queue name        |

## Usage

```typescript
import { ServiceBusService } from '@/azure/service-bus.service';

@Injectable()
export class OrderProcessor {
  constructor(private readonly serviceBus: ServiceBusService) {}

  async sendMessage(order: Order): Promise<void> {
    await this.serviceBus.sendMessage(this.configService.get('AZURE_SERVICEBUS_QUEUE'), {
      body: order,
    });
  }

  async receiveMessages(): Promise<Order[]> {
    const messages = await this.serviceBus.receiveMessages(
      this.configService.get('AZURE_SERVICEBUS_QUEUE'),
      { maxMessageCount: 10 },
    );
    return messages.map((m) => m.body as Order);
  }
}
```
