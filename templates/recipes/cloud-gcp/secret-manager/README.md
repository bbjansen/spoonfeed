# GCP Secret Manager

Google Cloud Secret Manager for secret storage in NestJS.

## Documentation

- [GCP Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [@google-cloud/secret-manager on npm](https://www.npmjs.com/package/@google-cloud/secret-manager)
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)

## Dependencies

| Package                        | Version | Purpose                            |
| ------------------------------ | ------- | ---------------------------------- |
| `@google-cloud/secret-manager` | `5.6.0` | Google Cloud Secret Manager client |

## Environment Variables

| Variable         | Default | Description    |
| ---------------- | ------- | -------------- |
| `GCP_PROJECT_ID` | —       | GCP project ID |

## Usage

```typescript
import { GcpSecretsService } from '@/gcp/secrets.service';

@Injectable()
export class DatabaseConfig {
  constructor(private readonly secrets: GcpSecretsService) {}

  async getDatabasePassword(): Promise<string> {
    return this.secrets.accessSecret('database-password');
  }

  async getApiKey(name: string): Promise<string> {
    return this.secrets.accessSecret(name);
  }
}
```
