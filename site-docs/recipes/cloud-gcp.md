# Cloud — GCP Recipes

spoonfeed provides 10 GCP recipes covering messaging, storage, databases, authentication, secrets, logging, caching, CDN, and serverless. Use these recipes when deploying to Google Cloud Platform infrastructure. Each recipe wraps an official `@google-cloud/*` client behind a NestJS injectable service.

All GCP recipes use the official `@google-cloud/*` packages with exact version pinning.

!!! tip "Recommended combinations"
    - **Typical API on GCP:** `gcp-cloud-storage` + `gcp-secret-manager` + `gcp-cloud-logging` + `gcp-cloud-sql`
    - **Event-driven architecture:** `gcp-pubsub` + `gcp-cloud-functions`
    - **Managed auth + caching:** `gcp-firebase-auth` + `gcp-memorystore`

!!! note "Application Default Credentials"
    All GCP recipes rely on Application Default Credentials (ADC). Set `GOOGLE_APPLICATION_CREDENTIALS` for local development or use Workload Identity on GKE. Avoid service account key files in production.

---

## GCP Pub/Sub

Google Cloud Pub/Sub messaging integration.

| | |
| --- | --- |
| **ID** | `gcp-pubsub` |
| **Dependencies** | `@google-cloud/pubsub` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP project ID |
| `PUBSUB_TOPIC` | | Pub/Sub topic name |
| `PUBSUB_SUBSCRIPTION` | | Pub/Sub subscription name |

**Usage:** Use `PubSubService` to publish and subscribe to messages. Use ordering keys for ordered delivery. Enable dead-letter topics for failed messages.

!!! warning "Requires a GCP project"
    Pub/Sub is a managed GCP service. For local development, use the [Pub/Sub emulator](https://cloud.google.com/pubsub/docs/emulator).

**Pairs well with:** `gcp-cloud-functions`, `dead-letter-queue`

---

## GCP Secret Manager

Google Cloud Secret Manager for secret storage.

| | |
| --- | --- |
| **ID** | `gcp-secret-manager` |
| **Dependencies** | `@google-cloud/secret-manager` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP project ID |

**Usage:** Use `GcpSecretsService` to fetch secrets at startup. Secrets are cached to reduce API calls. The app reads the latest version by default.

---

## GCP Cloud Storage

Google Cloud Storage for object storage.

| | |
| --- | --- |
| **ID** | `gcp-cloud-storage` |
| **Dependencies** | `@google-cloud/storage` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP project ID |
| `GCS_BUCKET` | | Cloud Storage bucket name |

**Usage:** Use `GcsStorageService` for file uploads, downloads, and signed URLs. Use signed URLs for client-side uploads.

---

## GCP Cloud Functions

Google Cloud Functions integration for serverless workloads.

| | |
| --- | --- |
| **ID** | `gcp-cloud-functions` |
| **Dependencies** | `@google-cloud/functions-framework` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP project ID |
| `FUNCTION_TARGET` | `handler` | Cloud Function entry point |

**Usage:** The NestJS app is wrapped for Cloud Functions via the functions-framework. Optimize for cold starts by using lazy initialization for heavy dependencies.

---

## GCP Firebase Auth

Firebase Authentication for user identity management.

| | |
| --- | --- |
| **ID** | `gcp-firebase-auth` |
| **Dependencies** | `firebase-admin` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP/Firebase project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | | Path to service account key JSON |

**Usage:** Apply `FirebaseAuthGuard` to validate Firebase ID tokens on protected routes. Initialize `firebase-admin` with application default credentials or a service account key.

---

## GCP Cloud Logging

Google Cloud Logging (Stackdriver) integration.

| | |
| --- | --- |
| **ID** | `gcp-cloud-logging` |
| **Dependencies** | `@google-cloud/logging` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP project ID |
| `GCP_LOG_NAME` | `nestjs-app` | Cloud Logging log name |

**Usage:** Application logs are shipped to Cloud Logging. Use structured JSON for query compatibility in Logs Explorer.

---

## GCP Cloud SQL

Google Cloud SQL managed database connection via TypeORM.

| | |
| --- | --- |
| **ID** | `gcp-cloud-sql` |
| **Dependencies** | `@nestjs/typeorm` `typeorm` `pg` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP project ID |
| `CLOUD_SQL_CONNECTION_NAME` | | Cloud SQL instance connection name |
| `DB_NAME` | `app` | Database name |
| `DB_USERNAME` | `postgres` | Database username |
| `DB_PASSWORD` | | Database password |

**Usage:** Use Cloud SQL Auth Proxy for local development. Enable IAM database authentication in production. Use private IP for VPC access.

---

## GCP Firestore

Google Cloud Firestore NoSQL document database.

| | |
| --- | --- |
| **ID** | `gcp-firestore` |
| **Dependencies** | `@google-cloud/firestore` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP project ID |
| `FIRESTORE_DATABASE_ID` | `(default)` | Firestore database ID |

**Usage:** Use `FirestoreService` for document CRUD operations. Use batched writes for multiple operations. Prefer queries with indexes over full scans.

---

## GCP Memorystore

Google Cloud Memorystore (Redis) for managed caching.

| | |
| --- | --- |
| **ID** | `gcp-memorystore` |
| **Dependencies** | `ioredis` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `MEMORYSTORE_HOST` | | Memorystore Redis host |
| `MEMORYSTORE_PORT` | `6379` | Memorystore Redis port |

**Usage:** Connect via `ioredis`. Enable AUTH and in-transit encryption for production. VPC peering is required for connectivity.

---

## GCP Cloud CDN

Google Cloud CDN for content delivery with signed URLs.

| | |
| --- | --- |
| **ID** | `gcp-cloud-cdn` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | | GCP project ID |
| `CDN_SIGNING_KEY_NAME` | | Cloud CDN signing key name |
| `CDN_SIGNING_KEY` | | Cloud CDN signing key (base64) |

**Usage:** Use `CdnService` to generate signed URLs for private content. CDN is configured at the infrastructure level; the app generates signed URLs for access control.

**Pairs well with:** `gcp-cloud-storage`
