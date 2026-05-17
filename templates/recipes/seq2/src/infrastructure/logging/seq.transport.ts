import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as SeqLogger } from 'seq-logging';

type SeqLogLevel = 'Verbose' | 'Debug' | 'Information' | 'Warning' | 'Error' | 'Fatal';

interface SeqTransportOptions {
  serverUrl: string;
  apiKey?: string;
  batchingDelay?: number;
}

@Injectable()
export class SeqTransport implements OnModuleDestroy {
  private readonly logger: SeqLogger;

  constructor(private readonly config: ConfigService) {
    const serverUrl = this.config.getOrThrow<string>('SEQ_SERVER_URL');

    this.logger = new SeqLogger({
      serverUrl,
      apiKey: this.config.get<string>('SEQ_API_KEY'),
      onError: (err: Error) => {
        console.error('[SeqTransport] Failed to ship log event:', err.message);
      },
    });
  }

  log(level: SeqLogLevel, messageTemplate: string, properties?: Record<string, unknown>): void {
    this.logger.emit({
      timestamp: new Date(),
      level,
      messageTemplate,
      properties,
    });
  }

  info(messageTemplate: string, properties?: Record<string, unknown>): void {
    this.log('Information', messageTemplate, properties);
  }

  warn(messageTemplate: string, properties?: Record<string, unknown>): void {
    this.log('Warning', messageTemplate, properties);
  }

  error(messageTemplate: string, properties?: Record<string, unknown>): void {
    this.log('Error', messageTemplate, properties);
  }

  debug(messageTemplate: string, properties?: Record<string, unknown>): void {
    this.log('Debug', messageTemplate, properties);
  }

  async onModuleDestroy(): Promise<void> {
    await this.logger.close();
  }
}
