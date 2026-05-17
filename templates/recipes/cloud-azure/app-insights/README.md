# Azure Application Insights

Azure Application Insights for telemetry and monitoring in NestJS.

## Documentation

- [Azure Application Insights Documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
- [applicationinsights on npm](https://www.npmjs.com/package/applicationinsights)
- [NestJS Logger](https://docs.nestjs.com/techniques/logger)

## Dependencies

| Package               | Version | Purpose                              |
| --------------------- | ------- | ------------------------------------ |
| `applicationinsights` | `3.4.0` | Application Insights SDK for Node.js |

## Environment Variables

| Variable                                | Default | Description                            |
| --------------------------------------- | ------- | -------------------------------------- |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | —       | Application Insights connection string |

## Usage

```typescript
import * as appInsights from 'applicationinsights';

// Initialize before NestJS bootstrap
appInsights
  .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .start();

// In services, use the TelemetryClient for custom events
@Injectable()
export class TelemetryService {
  private client = appInsights.defaultClient;

  trackEvent(name: string, properties?: Record<string, string>): void {
    this.client.trackEvent({ name, properties });
  }

  trackMetric(name: string, value: number): void {
    this.client.trackMetric({ name, value });
  }
}
```
