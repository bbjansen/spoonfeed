# AWS S3

Amazon S3 object storage integration for file uploads and downloads in NestJS.

## Documentation

- [AWS S3 Developer Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/)
- [@aws-sdk/client-s3 on npm](https://www.npmjs.com/package/@aws-sdk/client-s3)
- [@aws-sdk/s3-request-presigner on npm](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner)
- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)

## Dependencies

| Package                         | Version   | Purpose                 |
| ------------------------------- | --------- | ----------------------- |
| `@aws-sdk/client-s3`            | `3.712.0` | AWS SDK v3 S3 client    |
| `@aws-sdk/s3-request-presigner` | `3.712.0` | Generate presigned URLs |

## Environment Variables

| Variable     | Default     | Description    |
| ------------ | ----------- | -------------- |
| `AWS_REGION` | `eu-west-1` | AWS region     |
| `S3_BUCKET`  | `my-bucket` | S3 bucket name |

## Usage

```typescript
import { S3StorageService } from '@/aws/s3-storage.service';

@Injectable()
export class FileUploader {
  constructor(private readonly storage: S3StorageService) {}

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.storage.putObject({ key, body, contentType });
    return this.storage.getSignedUrl(key, 3600);
  }

  async download(key: string): Promise<Buffer> {
    return this.storage.getObject(key);
  }
}
```
