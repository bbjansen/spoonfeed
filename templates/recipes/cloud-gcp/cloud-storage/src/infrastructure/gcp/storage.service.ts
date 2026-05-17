import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class GcsStorageService {
  private readonly logger = new Logger(GcsStorageService.name);
  private readonly storage: Storage;

  constructor(private readonly config: ConfigService) {
    this.storage = new Storage({
      projectId: this.config.getOrThrow<string>('GCP_PROJECT_ID'),
    });
  }

  async upload(
    bucketName: string,
    fileName: string,
    content: Buffer,
    contentType?: string,
  ): Promise<void> {
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(fileName);
    await file.save(content, {
      metadata: contentType ? { contentType } : undefined,
    });
    this.logger.log(`Uploaded ${fileName} to gs://${bucketName}`);
  }

  async download(bucketName: string, fileName: string): Promise<Buffer> {
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(fileName);
    const [contents] = await file.download();
    this.logger.log(`Downloaded ${fileName} from gs://${bucketName}`);
    return contents;
  }

  async getSignedUrl(
    bucketName: string,
    fileName: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(fileName);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });
    return url;
  }
}
