# GCP Cloud Recipes

Google Cloud Platform service integrations for NestJS applications using official `@google-cloud` packages.

## Available Recipes

| #   | Service          | Description                         | GCP Docs                                                            | Package                                                                                    |
| --- | ---------------- | ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Cloud Storage    | Object storage for files and media  | [Cloud Storage Docs](https://cloud.google.com/storage/docs)         | [@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage)               |
| 2   | Pub/Sub          | Async messaging and event streaming | [Pub/Sub Docs](https://cloud.google.com/pubsub/docs)                | [@google-cloud/pubsub](https://www.npmjs.com/package/@google-cloud/pubsub)                 |
| 3   | Cloud Tasks      | Managed task queue for async work   | [Cloud Tasks Docs](https://cloud.google.com/tasks/docs)             | [@google-cloud/tasks](https://www.npmjs.com/package/@google-cloud/tasks)                   |
| 4   | Firestore        | Serverless document database        | [Firestore Docs](https://cloud.google.com/firestore/docs)           | [@google-cloud/firestore](https://www.npmjs.com/package/@google-cloud/firestore)           |
| 5   | Cloud SQL        | Managed PostgreSQL/MySQL            | [Cloud SQL Docs](https://cloud.google.com/sql/docs)                 | pg / mysql2 (via SQL connector)                                                            |
| 6   | Secret Manager   | Secure secret storage and rotation  | [Secret Manager Docs](https://cloud.google.com/secret-manager/docs) | [@google-cloud/secret-manager](https://www.npmjs.com/package/@google-cloud/secret-manager) |
| 7   | Cloud Logging    | Structured log ingestion            | [Cloud Logging Docs](https://cloud.google.com/logging/docs)         | [@google-cloud/logging](https://www.npmjs.com/package/@google-cloud/logging)               |
| 8   | Cloud Monitoring | Custom metrics and alerting         | [Cloud Monitoring Docs](https://cloud.google.com/monitoring/docs)   | [@google-cloud/monitoring](https://www.npmjs.com/package/@google-cloud/monitoring)         |
| 9   | Firebase Auth    | User authentication with Firebase   | [Firebase Auth Docs](https://firebase.google.com/docs/auth)         | [firebase-admin](https://www.npmjs.com/package/firebase-admin)                             |
| 10  | Cloud Run        | Serverless container deployment     | [Cloud Run Docs](https://cloud.google.com/run/docs)                 | N/A (deployment target)                                                                    |

## Authentication

GCP client libraries use Application Default Credentials (ADC):

1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to a service account JSON key
2. Default service account on GCE, GKE, Cloud Run, Cloud Functions
3. `gcloud auth application-default login` for local development

```typescript
import { Storage } from '@google-cloud/storage';

// Credentials resolved automatically via ADC
const storage = new Storage();
```

## Quick Start: Pub/Sub

```typescript
import { PubSub } from '@google-cloud/pubsub';

@Injectable()
export class EventPublisher {
  private pubsub = new PubSub();

  async publish(topic: string, data: Record<string, unknown>) {
    const dataBuffer = Buffer.from(JSON.stringify(data));
    await this.pubsub.topic(topic).publishMessage({ data: dataBuffer });
  }
}
```

## Quick Start: Secret Manager

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

@Injectable()
export class SecretService {
  private client = new SecretManagerServiceClient();

  async getSecret(name: string): Promise<string> {
    const [version] = await this.client.accessSecretVersion({
      name: `projects/my-project/secrets/${name}/versions/latest`,
    });
    return version.payload.data.toString();
  }
}
```

## Local Development

Use the [GCP Emulators](https://cloud.google.com/sdk/gcloud/reference/beta/emulators) for Pub/Sub, Firestore, and Datastore:

```bash
gcloud beta emulators pubsub start --project=test-project
gcloud beta emulators firestore start
```

## External Documentation

- [Google Cloud Node.js Client Libraries](https://cloud.google.com/nodejs/docs/reference)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)

## Related Recipes

- [Deployment](deployment.md) -- deploying to Cloud Run or GKE
