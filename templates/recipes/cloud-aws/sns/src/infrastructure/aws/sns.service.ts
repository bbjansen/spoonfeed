import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SNSClient,
  PublishCommand,
  SubscribeCommand,
  type MessageAttributeValue,
} from '@aws-sdk/client-sns';

@Injectable()
export class SnsService {
  private readonly client: SNSClient;
  private readonly logger = new Logger(SnsService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new SNSClient({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-1'),
    });
  }

  async publish(
    topicArn: string,
    message: string,
    attributes?: Record<string, MessageAttributeValue>,
  ): Promise<string> {
    const result = await this.client.send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: message,
        MessageAttributes: attributes,
      }),
    );
    this.logger.debug(`Published message: ${result.MessageId}`);
    return result.MessageId!;
  }

  async subscribe(topicArn: string, protocol: string, endpoint: string): Promise<string> {
    const result = await this.client.send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: protocol,
        Endpoint: endpoint,
      }),
    );
    this.logger.debug(`Subscription created: ${result.SubscriptionArn}`);
    return result.SubscriptionArn!;
  }
}
