# Azure Cloud Recipes

Microsoft Azure service integrations for NestJS applications using official `@azure` packages.

## Available Recipes

| #   | Service               | Description                                        | Azure Docs                                                                                           | Package                                                                          |
| --- | --------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Blob Storage          | Object storage for files, media, and backups       | [Blob Storage Docs](https://learn.microsoft.com/en-us/azure/storage/blobs/)                          | [@azure/storage-blob](https://www.npmjs.com/package/@azure/storage-blob)         |
| 2   | Service Bus           | Enterprise message broker with queues and topics   | [Service Bus Docs](https://learn.microsoft.com/en-us/azure/service-bus-messaging/)                   | [@azure/service-bus](https://www.npmjs.com/package/@azure/service-bus)           |
| 3   | Cosmos DB             | Multi-model globally distributed database          | [Cosmos DB Docs](https://learn.microsoft.com/en-us/azure/cosmos-db/)                                 | [@azure/cosmos](https://www.npmjs.com/package/@azure/cosmos)                     |
| 4   | Key Vault             | Secure storage for secrets, keys, and certificates | [Key Vault Docs](https://learn.microsoft.com/en-us/azure/key-vault/)                                 | [@azure/keyvault-secrets](https://www.npmjs.com/package/@azure/keyvault-secrets) |
| 5   | Azure AD / Entra ID   | OAuth 2.0 authentication and authorization         | [Entra ID Docs](https://learn.microsoft.com/en-us/entra/identity/)                                   | [@azure/identity](https://www.npmjs.com/package/@azure/identity)                 |
| 6   | Event Grid            | Event-driven serverless compute                    | [Event Grid Docs](https://learn.microsoft.com/en-us/azure/event-grid/)                               | [@azure/eventgrid](https://www.npmjs.com/package/@azure/eventgrid)               |
| 7   | Application Insights  | APM, logging, and distributed tracing              | [App Insights Docs](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview) | [applicationinsights](https://www.npmjs.com/package/applicationinsights)         |
| 8   | Azure Functions       | Serverless function deployment                     | [Functions Docs](https://learn.microsoft.com/en-us/azure/azure-functions/)                           | N/A (deployment target)                                                          |
| 9   | Azure SQL             | Managed SQL Server database                        | [Azure SQL Docs](https://learn.microsoft.com/en-us/azure/azure-sql/)                                 | mssql / tedious                                                                  |
| 10  | Azure Cache for Redis | Managed Redis instance                             | [Azure Cache Docs](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/)                   | [ioredis](https://www.npmjs.com/package/ioredis)                                 |

## Authentication

Azure SDK libraries use `@azure/identity` and the `DefaultAzureCredential` chain:

1. Environment variables (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`)
2. Managed Identity (on Azure VMs, App Service, Functions)
3. Azure CLI (`az login`) for local development
4. Visual Studio Code credential

```typescript
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const credential = new DefaultAzureCredential();
const client = new SecretClient('https://my-vault.vault.azure.net', credential);
```

## Quick Start: Blob Storage

```typescript
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

@Injectable()
export class BlobStorageService {
  private client: BlobServiceClient;

  constructor() {
    this.client = new BlobServiceClient(
      `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
      new DefaultAzureCredential(),
    );
  }

  async upload(container: string, name: string, data: Buffer) {
    const containerClient = this.client.getContainerClient(container);
    const blockBlobClient = containerClient.getBlockBlobClient(name);
    await blockBlobClient.upload(data, data.length);
  }
}
```

## Quick Start: Service Bus

```typescript
import { ServiceBusClient } from '@azure/service-bus';

@Injectable()
export class MessagePublisher {
  private client = new ServiceBusClient(process.env.AZURE_SERVICE_BUS_CONNECTION);

  async send(queue: string, body: Record<string, unknown>) {
    const sender = this.client.createSender(queue);
    await sender.sendMessages({ body });
    await sender.close();
  }
}
```

## Local Development

Use [Azurite](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite) for storage emulation:

```yaml
# docker-compose.yml
azurite:
  image: mcr.microsoft.com/azure-storage/azurite
  ports:
    - '10000:10000' # Blob
    - '10001:10001' # Queue
    - '10002:10002' # Table
```

## External Documentation

- [Azure SDK for JavaScript](https://learn.microsoft.com/en-us/azure/developer/javascript/)
- [@azure/identity](https://www.npmjs.com/package/@azure/identity)
- [Azurite Storage Emulator](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite)

## Related Recipes

- [Deployment](deployment.md) -- deploying to Azure App Service or AKS
- [CI/CD](ci-cd.md) -- Azure DevOps pipelines
