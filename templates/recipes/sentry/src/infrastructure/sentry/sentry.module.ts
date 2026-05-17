import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';

@Module({})
export class SentryModule implements OnApplicationBootstrap {
  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const dsn = this.config.get<string>('SENTRY_DSN');

    if (!dsn) {
      return;
    }

    Sentry.init({
      dsn,
      environment: this.config.get<string>('SENTRY_ENVIRONMENT', 'development'),
      tracesSampleRate: this.config.get<number>('SENTRY_TRACES_SAMPLE_RATE', 0.2),
      integrations: [Sentry.nestIntegration()],
    });
  }
}
