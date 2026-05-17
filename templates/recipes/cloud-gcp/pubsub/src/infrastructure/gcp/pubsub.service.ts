import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub, Subscription, Topic } from '@google-cloud/pubsub';

@Injectable()
export class PubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(PubSubService.name);
  private readonly client: PubSub;
  private readonly subscriptions: Subscription[] = [];

  constructor(private readonly config: ConfigService) {
    this.client = new PubSub({
      projectId: this.config.getOrThrow<string>('GCP_PROJECT_ID'),
    });
  }

  async publishMessage(
    topicName: string,
    data: string,
    attributes?: Record<string, string>,
  ): Promise<string> {
    const topic: Topic = this.client.topic(topicName);
    const dataBuffer = Buffer.from(data);
    const messageId = await topic.publishMessage({
      data: dataBuffer,
      attributes,
    });
    this.logger.log(`Message ${messageId} published to topic ${topicName}`);
    return messageId;
  }

  async createSubscription(
    topicName: string,
    subscriptionName: string,
    handler: (message: { data: Buffer; ack: () => void }) => void,
  ): Promise<Subscription> {
    const topic = this.client.topic(topicName);
    const [subscription] = await topic.createSubscription(subscriptionName).catch(() => {
      return [this.client.subscription(subscriptionName)];
    });

    subscription.on('message', (message) => {
      handler({ data: message.data, ack: () => message.ack() });
    });

    subscription.on('error', (error) => {
      this.logger.error(`Subscription ${subscriptionName} error: ${error.message}`);
    });

    this.subscriptions.push(subscription);
    this.logger.log(`Listening on subscription ${subscriptionName}`);
    return subscription;
  }

  async onModuleDestroy(): Promise<void> {
    for (const subscription of this.subscriptions) {
      subscription.removeAllListeners();
    }
  }
}
