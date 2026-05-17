import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

@Injectable()
export class KeyVaultService {
  private readonly logger = new Logger(KeyVaultService.name);
  private readonly client: SecretClient;

  constructor(private readonly config: ConfigService) {
    const vaultUrl = this.config.getOrThrow<string>('AZURE_KEY_VAULT_URL');
    const credential = new DefaultAzureCredential();
    this.client = new SecretClient(vaultUrl, credential);
  }

  async getSecret(name: string): Promise<string | undefined> {
    const secret = await this.client.getSecret(name);
    this.logger.log(`Retrieved secret "${name}"`);
    return secret.value;
  }

  async setSecret(name: string, value: string): Promise<void> {
    await this.client.setSecret(name, value);
    this.logger.log(`Set secret "${name}"`);
  }
}
