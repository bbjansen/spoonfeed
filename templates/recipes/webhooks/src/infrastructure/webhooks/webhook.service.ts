import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

export interface WebhookPayload {
  event: string;
  data: unknown;
  timestamp: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('WEBHOOK_SECRET', 'change-me');
  }

  async deliver(url: string, payload: WebhookPayload): Promise<boolean> {
    const body = JSON.stringify(payload);
    const signature = this.sign(body);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': payload.timestamp,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        this.logger.warn(`Webhook delivery failed: ${url} returned ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Webhook delivery error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }
}
