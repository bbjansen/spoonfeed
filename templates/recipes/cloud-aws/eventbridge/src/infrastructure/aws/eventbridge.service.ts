import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
  type PutEventsResultEntry,
} from '@aws-sdk/client-eventbridge';

@Injectable()
export class EventBridgeService {
  private readonly client: EventBridgeClient;
  private readonly logger = new Logger(EventBridgeService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new EventBridgeClient({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-1'),
    });
  }

  async putEvents(entries: PutEventsRequestEntry[]): Promise<PutEventsResultEntry[]> {
    const result = await this.client.send(new PutEventsCommand({ Entries: entries }));

    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
      this.logger.warn(`${result.FailedEntryCount} event(s) failed to deliver`);
    }

    this.logger.debug(`Put ${entries.length} event(s) to EventBridge`);
    return result.Entries ?? [];
  }

  async putEvent(
    source: string,
    detailType: string,
    detail: Record<string, unknown>,
    eventBusName?: string,
  ): Promise<PutEventsResultEntry> {
    const entries = await this.putEvents([
      {
        Source: source,
        DetailType: detailType,
        Detail: JSON.stringify(detail),
        EventBusName: eventBusName,
      },
    ]);
    return entries[0];
  }
}
