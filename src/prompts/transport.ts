import * as p from '@clack/prompts';
import type { TransportLayer } from '../types.js';

export async function promptTransport(): Promise<TransportLayer> {
  const result = await p.select({
    message: 'Which transport layer?',
    options: [
      { value: 'rabbitmq', label: 'RabbitMQ (AMQP)', hint: 'Enterprise routing, DLQs' },
      { value: 'kafka', label: 'Kafka', hint: 'Event streaming, high throughput' },
      { value: 'grpc', label: 'gRPC', hint: 'Protobuf RPC' },
      { value: 'redis', label: 'Redis', hint: 'Pub/sub messaging' },
      { value: 'nats', label: 'NATS', hint: 'Lightweight, high-performance' },
      { value: 'mqtt', label: 'MQTT', hint: 'IoT, low-bandwidth' },
      { value: 'tcp', label: 'TCP', hint: 'Simple, no broker' },
      { value: 'custom', label: 'Custom transporter', hint: 'Scaffold your own' },
    ],
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return result;
}
