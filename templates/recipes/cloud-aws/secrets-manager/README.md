# AWS Secrets Manager

Retrieve and cache secrets from AWS Secrets Manager in NestJS.

## Documentation

- [AWS Secrets Manager User Guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/)
- [@aws-sdk/client-secrets-manager on npm](https://www.npmjs.com/package/@aws-sdk/client-secrets-manager)
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)

## Dependencies

| Package                           | Version   | Purpose                           |
| --------------------------------- | --------- | --------------------------------- |
| `@aws-sdk/client-secrets-manager` | `3.712.0` | AWS SDK v3 Secrets Manager client |

## Environment Variables

| Variable     | Default     | Description |
| ------------ | ----------- | ----------- |
| `AWS_REGION` | `eu-west-1` | AWS region  |

## Usage

```typescript
import { SecretsService } from '@/aws/secrets.service';

@Injectable()
export class DatabaseConfig {
  constructor(private readonly secrets: SecretsService) {}

  async getConnectionString(): Promise<string> {
    const secret = await this.secrets.getSecret('prod/database/credentials');
    const parsed = JSON.parse(secret);
    return `postgresql://${parsed.username}:${parsed.password}@${parsed.host}:${parsed.port}/${parsed.dbname}`;
  }
}
```
