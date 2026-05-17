# Microservice Project Type

## When to Use

Choose `microservice` when you need a service that communicates with other services via message brokers or RPC rather than HTTP. Suitable for event-driven architectures, CQRS, or systems where services need loose coupling through asynchronous messaging.

## Transport Layer Options

| Transport | Protocol | Use Case                     | Package                               |
| --------- | -------- | ---------------------------- | ------------------------------------- |
| TCP       | TCP      | Simple RPC between services  | Built-in                              |
| Redis     | Pub/Sub  | Lightweight pub/sub          | `ioredis`                             |
| NATS      | NATS     | High-throughput messaging    | `nats`                                |
| MQTT      | MQTT     | IoT, low-bandwidth devices   | `mqtt`                                |
| RabbitMQ  | AMQP     | Reliable queuing, routing    | `amqplib`                             |
| Kafka     | Kafka    | Event streaming, high volume | `kafkajs`                             |
| gRPC      | HTTP/2   | Typed RPC, cross-language    | `@grpc/grpc-js`, `@grpc/proto-loader` |
| SQS       | HTTPS    | AWS-native queuing           | `@aws-sdk/client-sqs`                 |

### Transport Configuration

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from '@/app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'orders_queue',
      queueOptions: { durable: true },
    },
  });

  await app.listen();
}

bootstrap();
```

## Message Patterns

### @MessagePattern -- Request/Response

Use for synchronous-style RPC where the sender expects a reply.

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class OrderHandler {
  @MessagePattern('order.findOne')
  findOne(@Payload() data: { id: string }) {
    return this.orderService.findOne(data.id);
  }

  @MessagePattern('order.create')
  create(@Payload() data: CreateOrderDto) {
    return this.orderService.create(data);
  }
}
```

Calling from another service:

```typescript
@Injectable()
export class OrderClient {
  constructor(@Inject('ORDER_SERVICE') private client: ClientProxy) {}

  findOne(id: string) {
    return this.client.send('order.findOne', { id });
  }
}
```

### @EventPattern -- Fire and Forget

Use for events where the sender does not need a response.

```typescript
@Controller()
export class NotificationHandler {
  @EventPattern('order.created')
  handleOrderCreated(@Payload() data: OrderCreatedEvent) {
    // Send notification, no response needed
    this.notificationService.sendConfirmation(data.userId, data.orderId);
  }
}
```

Emitting events:

```typescript
this.client.emit('order.created', {
  orderId: order.id,
  userId: order.userId,
  total: order.total,
});
```

## Hybrid Mode (HTTP + Microservice)

Run both HTTP and microservice transports in the same application. Useful when a service needs to expose a health-check endpoint or admin API alongside its message-based interface.

```typescript
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '@/app.module';

async function bootstrap() {
  // HTTP server
  const app = await NestFactory.create(AppModule, new FastifyAdapter());

  // Attach microservice transport
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'orders_queue',
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
```

## Testing Microservices

### Unit Testing Handlers

```typescript
import { Test } from '@nestjs/testing';
import { OrderHandler } from '@/orders/order.handler';
import { OrderService } from '@/orders/order.service';

describe('OrderHandler', () => {
  let handler: OrderHandler;
  let service: OrderService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrderHandler, OrderService],
    }).compile();

    handler = module.get(OrderHandler);
    service = module.get(OrderService);
  });

  it('should return order by id', async () => {
    const order = { id: '1', product: 'Widget' };
    jest.spyOn(service, 'findOne').mockResolvedValue(order);

    const result = await handler.findOne({ id: '1' });
    expect(result).toEqual(order);
  });
});
```

### Integration Testing with ClientProxy

```typescript
import { Test } from '@nestjs/testing';
import { Transport, ClientsModule } from '@nestjs/microservices';

describe('Order Microservice (integration)', () => {
  let app;
  let client;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        AppModule,
        ClientsModule.register([
          {
            name: 'ORDER_SERVICE',
            transport: Transport.TCP,
            options: { port: 4010 },
          },
        ]),
      ],
    }).compile();

    app = module.createNestMicroservice({
      transport: Transport.TCP,
      options: { port: 4010 },
    });

    await app.listen();
    client = app.get('ORDER_SERVICE');
    await client.connect();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create an order via message pattern', (done) => {
    client.send('order.create', { productId: 'abc' }).subscribe((result) => {
      expect(result.id).toBeDefined();
      done();
    });
  });
});
```
