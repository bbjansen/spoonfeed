import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  type InputLogEvent,
} from '@aws-sdk/client-cloudwatch-logs';

@Injectable()
export class CloudWatchService {
  private readonly client: CloudWatchLogsClient;
  private readonly logger = new Logger(CloudWatchService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new CloudWatchLogsClient({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-1'),
    });
  }

  async putLogEvents(
    logGroupName: string,
    logStreamName: string,
    messages: string[],
  ): Promise<void> {
    const logEvents: InputLogEvent[] = messages.map((message) => ({
      message,
      timestamp: Date.now(),
    }));

    await this.client.send(
      new PutLogEventsCommand({
        logGroupName,
        logStreamName,
        logEvents,
      }),
    );

    this.logger.debug(`Put ${messages.length} log event(s) to ${logGroupName}/${logStreamName}`);
  }
}
