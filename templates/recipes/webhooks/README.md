# Webhook Delivery

Outbound webhook system with HMAC-SHA256 signing and configurable timeouts.

## Links

- [Webhook Best Practices (Standard Webhooks)](https://www.standardwebhooks.com/)
- [HMAC (RFC 2104)](https://datatracker.ietf.org/doc/html/rfc2104)

## Dependencies

No additional dependencies required.

## Environment Variables

| Variable         | Default     | Description                      |
| ---------------- | ----------- | -------------------------------- |
| `WEBHOOK_SECRET` | `change-me` | HMAC secret for signing payloads |

## Usage

Inject `WebhookService` and call `deliver()` with a target URL and payload:

```typescript
import { WebhookService, WebhookPayload } from '@/infrastructure/webhooks/webhook.service';

@Injectable()
export class OrderService {
  constructor(private readonly webhooks: WebhookService) {}

  async completeOrder(order: Order): Promise<void> {
    await this.save(order);

    await this.webhooks.deliver('https://partner.example.com/hooks', {
      event: 'order.completed',
      data: { orderId: order.id, total: order.total },
      timestamp: new Date().toISOString(),
    });
  }
}
```

### HMAC Signature Verification (Consumer Side)

Consumers verify the signature by computing HMAC-SHA256 of the raw request body using the shared secret:

```typescript
import { createHmac } from 'node:crypto';

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Retry Strategy

The service includes a 10-second timeout per delivery attempt. For production use, combine with a queue (BullMQ or RabbitMQ) for automatic retries with exponential backoff:

1. Enqueue webhook deliveries instead of sending inline
2. Configure max retries and backoff in the queue processor
3. Route permanently failed deliveries to a dead letter queue

### Delivery Logging

All delivery attempts are logged via NestJS Logger:

- Successful deliveries: debug level
- Non-2xx responses: warn level with status code
- Network errors: error level with message

## Generated Files

| File                                             | Description                                |
| ------------------------------------------------ | ------------------------------------------ |
| `src/infrastructure/webhooks/webhook.service.ts` | Webhook delivery service with HMAC signing |
