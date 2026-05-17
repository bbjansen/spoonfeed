import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

@Injectable()
export class SecretsService {
  private readonly client: SecretsManagerClient;
  private readonly logger = new Logger(SecretsService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new SecretsManagerClient({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-1'),
    });
  }

  async getSecret(secretId: string, versionStage = 'AWSCURRENT'): Promise<string> {
    const result = await this.client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionStage: versionStage,
      }),
    );

    if (!result.SecretString) {
      throw new Error(`Secret "${secretId}" has no string value`);
    }

    this.logger.debug(`Retrieved secret: ${secretId}`);
    return result.SecretString;
  }

  async getSecretJson<T = Record<string, unknown>>(
    secretId: string,
    versionStage = 'AWSCURRENT',
  ): Promise<T> {
    const raw = await this.getSecret(secretId, versionStage);
    return JSON.parse(raw) as T;
  }
}
