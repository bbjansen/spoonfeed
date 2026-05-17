# GCP Cloud Storage

Google Cloud Storage for object storage in NestJS.

## Documentation

- [GCP Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [@google-cloud/storage on npm](https://www.npmjs.com/package/@google-cloud/storage)
- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)

## Dependencies

| Package                 | Version  | Purpose                     |
| ----------------------- | -------- | --------------------------- |
| `@google-cloud/storage` | `7.14.0` | Google Cloud Storage client |

## Environment Variables

| Variable         | Default | Description               |
| ---------------- | ------- | ------------------------- |
| `GCP_PROJECT_ID` | —       | GCP project ID            |
| `GCS_BUCKET`     | —       | Cloud Storage bucket name |

## Usage

```typescript
import { GcsStorageService } from '@/gcp/gcs-storage.service';

@Injectable()
export class FileUploader {
  constructor(private readonly storage: GcsStorageService) {}

  async upload(fileName: string, content: Buffer, contentType: string): Promise<string> {
    await this.storage.uploadFile(
      this.configService.get('GCS_BUCKET'),
      fileName,
      content,
      contentType,
    );
    return this.storage.getSignedUrl(this.configService.get('GCS_BUCKET'), fileName, 3600);
  }
}
```
