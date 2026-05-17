import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as appInsights from 'applicationinsights';

@Injectable()
export class AppInsightsService implements OnModuleInit {
  private readonly logger = new Logger(AppInsightsService.name);
  private client!: appInsights.TelemetryClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const connectionString = this.config.getOrThrow<string>(
      'APPLICATIONINSIGHTS_CONNECTION_STRING',
    );

    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectExceptions(true)
      .start();

    this.client = appInsights.defaultClient;
    this.logger.log('Application Insights initialized');
  }

  trackEvent(name: string, properties?: Record<string, string>): void {
    this.client.trackEvent({ name, properties });
  }

  trackException(error: Error, properties?: Record<string, string>): void {
    this.client.trackException({ exception: error, properties });
  }

  trackMetric(name: string, value: number): void {
    this.client.trackMetric({ name, value });
  }
}
