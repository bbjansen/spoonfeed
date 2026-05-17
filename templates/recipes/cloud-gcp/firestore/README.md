# GCP Firestore

Google Cloud Firestore NoSQL document database integration for NestJS.

## Documentation

- [GCP Firestore Documentation](https://cloud.google.com/firestore/docs)
- [@google-cloud/firestore on npm](https://www.npmjs.com/package/@google-cloud/firestore)

## Dependencies

| Package                   | Version  | Purpose                       |
| ------------------------- | -------- | ----------------------------- |
| `@google-cloud/firestore` | `7.11.0` | Google Cloud Firestore client |

## Environment Variables

| Variable                | Default     | Description           |
| ----------------------- | ----------- | --------------------- |
| `GCP_PROJECT_ID`        | —           | GCP project ID        |
| `FIRESTORE_DATABASE_ID` | `(default)` | Firestore database ID |

## Usage

```typescript
import { FirestoreService } from '@/gcp/firestore.service';

@Injectable()
export class UserRepository {
  constructor(private readonly firestore: FirestoreService) {}

  async findById(userId: string): Promise<User | undefined> {
    const doc = await this.firestore.doc(`users/${userId}`).get();
    return doc.exists ? (doc.data() as User) : undefined;
  }

  async save(user: User): Promise<void> {
    await this.firestore.doc(`users/${user.id}`).set(user);
  }

  async findByEmail(email: string): Promise<User[]> {
    const snapshot = await this.firestore.collection('users').where('email', '==', email).get();
    return snapshot.docs.map((doc) => doc.data() as User);
  }
}
```
