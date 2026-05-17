import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ServiceBusClient,
  ServiceBusMessage,
  ServiceBusReceivedMessage,
  ServiceBusSender,
  ServiceBusReceiver,
} from '@azure/service-bus';

@Injectable()
export class ServiceBusService implements OnModuleDestroy {
  private readonly logger = new Logger(ServiceBusService.name);
  private readonly client: ServiceBusClient;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.config.getOrThrow<string>('AZURE_SERVICE_BUS_CONNECTION_STRING');
    this.client = new ServiceBusClient(connectionString);
  }

  async sendMessage(queueOrTopic: string, body: unknown): Promise<void> {
    const sender: ServiceBusSender = this.client.createSender(queueOrTopic);

    try {
      const message: ServiceBusMessage = { body };
      await sender.sendMessages(message);
      this.logger.log(`Message sent to "${queueOrTopic}"`);
    } finally {
      await sender.close();
    }
  }

  async receiveMessages(
    queueOrTopic: string,
    maxMessageCount = 10,
    maxWaitTimeInMs = 5000,
  ): Promise<ServiceBusReceivedMessage[]> {
    const receiver: ServiceBusReceiver = this.client.createReceiver(queueOrTopic);

    try {
      const messages = await receiver.receiveMessages(maxMessageCount, { maxWaitTimeInMs });
      this.logger.log(`Received ${messages.length} message(s) from "${queueOrTopic}"`);
      return messages;
    } finally {
      await receiver.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
