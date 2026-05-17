# Azure Blob Storage

Azure Blob Storage for object storage in NestJS.

## Documentation

- [Azure Blob Storage Documentation](https://learn.microsoft.com/en-us/azure/storage/blobs/)
- [@azure/storage-blob on npm](https://www.npmjs.com/package/@azure/storage-blob)
- [@azure/identity on npm](https://www.npmjs.com/package/@azure/identity)
- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)

## Dependencies

| Package               | Version   | Purpose                           |
| --------------------- | --------- | --------------------------------- |
| `@azure/storage-blob` | `12.26.0` | Azure Blob Storage client         |
| `@azure/identity`     | `4.5.0`   | Azure identity and authentication |

## Environment Variables

| Variable                          | Default   | Description                     |
| --------------------------------- | --------- | ------------------------------- |
| `AZURE_STORAGE_CONNECTION_STRING` | —         | Azure Storage connection string |
| `AZURE_STORAGE_CONTAINER`         | `uploads` | Blob container name             |

## Usage

```typescript
import { BlobStorageService } from '@/azure/blob-storage.service';

@Injectable()
export class FileUploader {
  constructor(private readonly blobStorage: BlobStorageService) {}

  async upload(fileName: string, content: Buffer, contentType: string): Promise<string> {
    await this.blobStorage.uploadBlob(
      this.configService.get('AZURE_STORAGE_CONTAINER'),
      fileName,
      content,
      contentType,
    );
    return this.blobStorage.generateSasUrl(
      this.configService.get('AZURE_STORAGE_CONTAINER'),
      fileName,
      3600,
    );
  }
}
```
