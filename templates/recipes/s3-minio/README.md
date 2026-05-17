# S3 / MinIO

Object storage service using the AWS SDK v3, compatible with S3 and MinIO.

## Links

- [AWS SDK for JavaScript v3 Developer Guide](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [@aws-sdk/client-s3 on npm](https://www.npmjs.com/package/@aws-sdk/client-s3)
- [@aws-sdk/s3-request-presigner on npm](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner)
- [@aws-sdk/client-s3 on GitHub](https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-s3)

## Dependencies

| Package                         | Version   | Purpose                                |
| ------------------------------- | --------- | -------------------------------------- |
| `@aws-sdk/client-s3`            | `3.750.0` | S3 client for upload, download, delete |
| `@aws-sdk/s3-request-presigner` | `3.750.0` | Generate presigned URLs                |

## Environment Variables

| Variable               | Description                              | Example                 |
| ---------------------- | ---------------------------------------- | ----------------------- |
| `S3_ENDPOINT`          | S3-compatible endpoint URL               | `http://localhost:9000` |
| `S3_REGION`            | AWS region                               | `eu-west-1`             |
| `S3_ACCESS_KEY_ID`     | Access key ID                            | `minioadmin`            |
| `S3_SECRET_ACCESS_KEY` | Secret access key                        | `minioadmin`            |
| `S3_BUCKET`            | Default bucket name                      | `my-bucket`             |
| `S3_FORCE_PATH_STYLE`  | Use path-style URLs (required for MinIO) | `true`                  |

## Usage

```typescript
import { StorageModule } from '@/infrastructure/storage/storage.module';

@Module({
  imports: [StorageModule],
})
export class AppModule {}

// In a service
constructor(private readonly storage: StorageService) {}

const url = await this.storage.upload('avatars/user-1.png', buffer, 'image/png');
const presigned = await this.storage.getPresignedUrl('avatars/user-1.png');
```

## Generated Files

| File                                            | Description                                         |
| ----------------------------------------------- | --------------------------------------------------- |
| `src/infrastructure/storage/storage.service.ts` | S3 upload, download, delete, and presign operations |
| `src/infrastructure/storage/storage.module.ts`  | Storage module with S3 client provider              |
