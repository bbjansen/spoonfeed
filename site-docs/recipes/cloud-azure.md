# Cloud — Azure Recipes

spoonfeed provides 10 Azure recipes covering messaging, storage, databases, authentication, secrets, monitoring, caching, CDN, and serverless. Use these recipes when deploying to Microsoft Azure infrastructure. Each recipe wraps an official `@azure/*` client behind a NestJS injectable service.

All Azure recipes use the official `@azure/*` packages with exact version pinning. Most use `@azure/identity` for `DefaultAzureCredential` support, enabling managed identity authentication in production.

!!! tip "Recommended combinations"
    - **Typical API on Azure:** `azure-blob-storage` + `azure-key-vault` + `azure-app-insights` + `azure-sql-database`
    - **Event-driven architecture:** `azure-service-bus` + `azure-functions`
    - **Managed auth + caching:** `azure-entra-id` + `azure-cache`

!!! note "Managed Identity"
    Use `DefaultAzureCredential` from `@azure/identity` in production. It supports Managed Identity on Azure App Service, AKS, and Azure Functions without managing secrets. For local development, use the Azure CLI login (`az login`).

---

## Azure Service Bus

Azure Service Bus for enterprise messaging.

| | |
| --- | --- |
| **ID** | `azure-service-bus` |
| **Dependencies** | `@azure/service-bus` `@azure/identity` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | | Service Bus connection string |
| `AZURE_SERVICEBUS_QUEUE` | | Service Bus queue name |

**Usage:** Use `ServiceBusService` to send and receive messages. Use sessions for ordered processing. Complete messages after processing. Configure dead-letter queues for poison messages.

!!! warning "Requires an Azure subscription"
    Service Bus is a managed Azure service. For local development, use connection strings from a dev-tier Service Bus namespace.

**Pairs well with:** `dead-letter-queue`, `transactional-outbox`

---

## Azure Key Vault

Azure Key Vault for secret and key management.

| | |
| --- | --- |
| **ID** | `azure-key-vault` |
| **Dependencies** | `@azure/keyvault-secrets` `@azure/identity` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_KEY_VAULT_URL` | | Key Vault URL (`https://<name>.vault.azure.net`) |

**Usage:** Use `KeyVaultService` to fetch secrets at startup. Secrets are cached to reduce API calls. Authenticate via `DefaultAzureCredential` for managed identity support in production.

---

## Azure Blob Storage

Azure Blob Storage for object storage.

| | |
| --- | --- |
| **ID** | `azure-blob-storage` |
| **Dependencies** | `@azure/storage-blob` `@azure/identity` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_STORAGE_ACCOUNT_NAME` | | Azure Storage account name |
| `AZURE_STORAGE_ACCOUNT_KEY` | | Azure Storage account key |

**Usage:** Use `BlobStorageService` for uploads, downloads, and SAS URL generation. Use managed identity (`DefaultAzureCredential`) in production instead of account keys.

---

## Azure Functions

Azure Functions integration for serverless workloads.

| | |
| --- | --- |
| **ID** | `azure-functions` |
| **Dependencies** | `@azure/functions` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_FUNCTIONS_ENVIRONMENT` | `Development` | Azure Functions environment |

**Usage:** The NestJS app is adapted for Azure Functions via the `@azure/functions` runtime. Configure triggers and bindings (HTTP, timer, queue) in the function definition files. Optimize for cold starts.

---

## Azure Entra ID

Azure Entra ID (formerly Azure AD) authentication.

| | |
| --- | --- |
| **ID** | `azure-entra-id` |
| **Dependencies** | `@azure/msal-node` `@azure/identity` `jsonwebtoken` `jwks-rsa` |
| **Dev dependencies** | `@types/jsonwebtoken` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_TENANT_ID` | | Azure Entra ID tenant ID |
| `AZURE_CLIENT_ID` | | Azure Entra ID client (application) ID |
| `AZURE_CLIENT_SECRET` | | Azure Entra ID client secret |

**Usage:** Apply `EntraIdGuard` to validate Entra ID JWT tokens on protected routes. Use app roles for RBAC.

---

## Azure Application Insights

Azure Application Insights for telemetry and monitoring.

| | |
| --- | --- |
| **ID** | `azure-app-insights` |
| **Dependencies** | `applicationinsights` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | | Application Insights connection string |

**Usage:** Application Insights collects telemetry, traces, and exceptions automatically. Use `TelemetryClient` for custom events and metrics.

---

## Azure Cosmos DB

Azure Cosmos DB NoSQL database integration.

| | |
| --- | --- |
| **ID** | `azure-cosmos-db` |
| **Dependencies** | `@azure/cosmos` `@azure/identity` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_COSMOS_ENDPOINT` | | Cosmos DB account endpoint |
| `AZURE_COSMOS_KEY` | | Cosmos DB account key |
| `AZURE_COSMOS_DATABASE` | `app` | Cosmos DB database name |

**Usage:** Use `CosmosDbService` for container and item operations. Choose partition keys carefully for optimal performance and cost. Use cross-partition queries sparingly.

---

## Azure SQL Database

Azure SQL Database managed connection via TypeORM.

| | |
| --- | --- |
| **ID** | `azure-sql-database` |
| **Dependencies** | `@nestjs/typeorm` `typeorm` `mssql` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_SQL_HOST` | | Azure SQL server hostname |
| `AZURE_SQL_PORT` | `1433` | Azure SQL port |
| `AZURE_SQL_DATABASE` | `app` | Azure SQL database name |
| `AZURE_SQL_USERNAME` | | Azure SQL username |
| `AZURE_SQL_PASSWORD` | | Azure SQL password |

**Usage:** Enable encryption for all connections. Use Azure AD managed identity authentication in production.

---

## Azure Cache for Redis

Azure Cache for Redis managed caching service.

| | |
| --- | --- |
| **ID** | `azure-cache` |
| **Dependencies** | `ioredis` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_REDIS_HOST` | | Azure Cache for Redis hostname |
| `AZURE_REDIS_PORT` | `6380` | Azure Cache for Redis port (TLS) |
| `AZURE_REDIS_PASSWORD` | | Azure Cache for Redis access key |

**Usage:** Connect via `ioredis` with TLS on port 6380. Use managed identity in production instead of access keys.

---

## Azure Front Door

Azure Front Door CDN and global load balancer.

| | |
| --- | --- |
| **ID** | `azure-front-door` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AZURE_FRONTDOOR_HOSTNAME` | | Azure Front Door hostname |
| `AZURE_FRONTDOOR_HEADER` | `X-Azure-FDID` | Front Door ID header name |
| `AZURE_FRONTDOOR_ID` | | Azure Front Door ID for request validation |

**Usage:** Validate that requests come through Front Door by checking the `X-Azure-FDID` header. Block direct-to-origin requests in production.

**Pairs well with:** `azure-blob-storage`
