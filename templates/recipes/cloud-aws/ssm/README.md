# AWS SSM Parameter Store

Retrieve configuration from AWS Systems Manager Parameter Store in NestJS.

## Documentation

- [AWS SSM Parameter Store User Guide](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [@aws-sdk/client-ssm on npm](https://www.npmjs.com/package/@aws-sdk/client-ssm)
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)

## Dependencies

| Package               | Version   | Purpose               |
| --------------------- | --------- | --------------------- |
| `@aws-sdk/client-ssm` | `3.712.0` | AWS SDK v3 SSM client |

## Environment Variables

| Variable     | Default     | Description               |
| ------------ | ----------- | ------------------------- |
| `AWS_REGION` | `eu-west-1` | AWS region                |
| `SSM_PREFIX` | `/app/prod` | SSM parameter path prefix |

## Usage

```typescript
import { SsmService } from '@/aws/ssm.service';

@Injectable()
export class AppConfig {
  constructor(private readonly ssm: SsmService) {}

  async loadParameters(): Promise<Map<string, string>> {
    return this.ssm.getParametersByPath(this.configService.get('SSM_PREFIX'));
  }

  async getParameter(name: string): Promise<string> {
    return this.ssm.getParameter(`${this.configService.get('SSM_PREFIX')}/${name}`);
  }
}
```
