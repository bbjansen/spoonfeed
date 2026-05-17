import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logging, Log, Entry } from '@google-cloud/logging';

interface LogEntry {
  severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  [key: string]: unknown;
}

@Injectable()
export class CloudLoggingService implements OnModuleDestroy {
  private readonly logger = new Logger(CloudLoggingService.name);
  private readonly logging: Logging;
  private readonly defaultLogName: string;

  constructor(private readonly config: ConfigService) {
    this.logging = new Logging({
      projectId: this.config.getOrThrow<string>('GCP_PROJECT_ID'),
    });
    this.defaultLogName = this.config.get<string>('GCP_LOG_NAME', 'nestjs-app');
  }

  async writeLog(entry: LogEntry, logName?: string): Promise<void> {
    const log: Log = this.logging.log(logName ?? this.defaultLogName);
    const { severity, message, ...metadata } = entry;

    const logEntry: Entry = log.entry(
      { severity, resource: { type: 'global' } },
      { message, ...metadata },
    );

    await log.write(logEntry);
  }

  async writeBatch(entries: LogEntry[], logName?: string): Promise<void> {
    const log: Log = this.logging.log(logName ?? this.defaultLogName);

    const logEntries = entries.map((entry) => {
      const { severity, message, ...metadata } = entry;
      return log.entry({ severity, resource: { type: 'global' } }, { message, ...metadata });
    });

    await log.write(logEntries);
  }

  async onModuleDestroy(): Promise<void> {
    await this.logging.close();
  }
}
