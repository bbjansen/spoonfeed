# Azure Key Vault

Azure Key Vault for secret and key management in NestJS.

## Documentation

- [Azure Key Vault Documentation](https://learn.microsoft.com/en-us/azure/key-vault/)
- [@azure/keyvault-secrets on npm](https://www.npmjs.com/package/@azure/keyvault-secrets)
- [@azure/identity on npm](https://www.npmjs.com/package/@azure/identity)
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)

## Dependencies

| Package                   | Version | Purpose                           |
| ------------------------- | ------- | --------------------------------- |
| `@azure/keyvault-secrets` | `4.9.0` | Azure Key Vault secrets client    |
| `@azure/identity`         | `4.5.0` | Azure identity and authentication |

## Environment Variables

| Variable             | Default | Description                                      |
| -------------------- | ------- | ------------------------------------------------ |
| `AZURE_KEYVAULT_URL` | —       | Key Vault URL (https://\<name\>.vault.azure.net) |

## Usage

```typescript
import { KeyVaultService } from '@/azure/key-vault.service';

@Injectable()
export class DatabaseConfig {
  constructor(private readonly keyVault: KeyVaultService) {}

  async getDatabasePassword(): Promise<string> {
    return this.keyVault.getSecret('database-password');
  }

  async getApiKey(name: string): Promise<string> {
    return this.keyVault.getSecret(name);
  }
}
```
