import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

@Injectable()
export class GcpSecretsService {
  private readonly logger = new Logger(GcpSecretsService.name);
  private readonly client: SecretManagerServiceClient;
  private readonly projectId: string;

  constructor(private readonly config: ConfigService) {
    this.client = new SecretManagerServiceClient();
    this.projectId = this.config.getOrThrow<string>('GCP_PROJECT_ID');
  }

  async getSecret(secretName: string, version = 'latest'): Promise<string> {
    const name = `projects/${this.projectId}/secrets/${secretName}/versions/${version}`;
    const [response] = await this.client.accessSecretVersion({ name });
    const payload = response.payload?.data;

    if (!payload) {
      throw new Error(`Secret ${secretName} has no payload`);
    }

    this.logger.log(`Accessed secret ${secretName} version ${version}`);
    return typeof payload === 'string' ? payload : new TextDecoder('utf-8').decode(payload);
  }

  async getSecretJson<T = Record<string, unknown>>(
    secretName: string,
    version = 'latest',
  ): Promise<T> {
    const raw = await this.getSecret(secretName, version);

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(`Secret ${secretName} is not valid JSON`);
    }
  }
}
