import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Firestore, DocumentData, WhereFilterOp } from '@google-cloud/firestore';

@Injectable()
export class FirestoreService {
  private readonly logger = new Logger(FirestoreService.name);
  private readonly firestore: Firestore;

  constructor(private readonly config: ConfigService) {
    this.firestore = new Firestore({
      projectId: this.config.getOrThrow<string>('GCP_PROJECT_ID'),
      databaseId: this.config.get<string>('FIRESTORE_DATABASE_ID', '(default)'),
    });
  }

  async get<T = DocumentData>(collection: string, documentId: string): Promise<T | undefined> {
    const doc = await this.firestore.collection(collection).doc(documentId).get();
    return doc.exists ? (doc.data() as T) : undefined;
  }

  async set(collection: string, documentId: string, data: DocumentData): Promise<void> {
    await this.firestore.collection(collection).doc(documentId).set(data, { merge: true });
    this.logger.log(`Document ${documentId} written to ${collection}`);
  }

  async query<T = DocumentData>(
    collection: string,
    field: string,
    operator: WhereFilterOp,
    value: unknown,
  ): Promise<T[]> {
    const snapshot = await this.firestore
      .collection(collection)
      .where(field, operator, value)
      .get();
    return snapshot.docs.map((doc) => doc.data() as T);
  }

  async delete(collection: string, documentId: string): Promise<void> {
    await this.firestore.collection(collection).doc(documentId).delete();
    this.logger.log(`Document ${documentId} deleted from ${collection}`);
  }
}
