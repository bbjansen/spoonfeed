# GCP Cloud Logging

Google Cloud Logging (Stackdriver) integration for NestJS.

## Documentation

- [GCP Cloud Logging Documentation](https://cloud.google.com/logging/docs)
- [@google-cloud/logging on npm](https://www.npmjs.com/package/@google-cloud/logging)
- [NestJS Logger](https://docs.nestjs.com/techniques/logger)

## Dependencies

| Package                 | Version  | Purpose                     |
| ----------------------- | -------- | --------------------------- |
| `@google-cloud/logging` | `11.2.0` | Google Cloud Logging client |

## Environment Variables

| Variable         | Default      | Description            |
| ---------------- | ------------ | ---------------------- |
| `GCP_PROJECT_ID` | —            | GCP project ID         |
| `GCP_LOG_NAME`   | `nestjs-app` | Cloud Logging log name |

## Usage

```typescript
import { CloudLoggingService } from '@/gcp/cloud-logging.service';

@Injectable()
export class AppLogger {
  constructor(private readonly cloudLogger: CloudLoggingService) {}

  info(message: string, metadata: Record<string, unknown>): void {
    this.cloudLogger.write({
      logName: this.configService.get('GCP_LOG_NAME'),
      severity: 'INFO',
      message,
      ...metadata,
    });
  }
}
```
