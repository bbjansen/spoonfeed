# Storage Recipes

Object storage integration for NestJS. Upload, download, and manage files with S3-compatible APIs.

## Available Recipes

| Recipe     | Provider                                                 | Best For                             | Recipe README                                                   |
| ---------- | -------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| S3 / MinIO | AWS S3 or S3-compatible (MinIO, R2, DigitalOcean Spaces) | File uploads, media storage, backups | [s3-minio](../../packages/templates/recipes/s3-minio/README.md) |

## Overview

The S3/MinIO recipe uses the AWS SDK v3 `@aws-sdk/client-s3` which is compatible with any S3-compatible storage provider. Use MinIO in local development and S3 (or alternatives) in production.

## Quick Start

```typescript
// storage.module.ts
import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

@Module({
  providers: [
    {
      provide: S3Client,
      useFactory: () =>
        new S3Client({
          region: process.env.AWS_REGION,
          endpoint: process.env.S3_ENDPOINT, // MinIO: http://localhost:9000
          forcePathStyle: true, // required for MinIO
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
```

```typescript
// storage.service.ts
import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  constructor(private readonly s3: S3Client) {}

  async upload(bucket: string, key: string, body: Buffer, contentType: string) {
    await this.s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getSignedDownloadUrl(bucket: string, key: string, expiresIn = 3600) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
  }

  async delete(bucket: string, key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
```

## Local Development with MinIO

Add to `docker-compose.yml`:

```yaml
minio:
  image: minio/minio
  ports:
    - '9000:9000'
    - '9001:9001'
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  command: server /data --console-address ":9001"
```

## External Documentation

- [AWS SDK v3 S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- [@aws-sdk/client-s3](https://www.npmjs.com/package/@aws-sdk/client-s3)
- [@aws-sdk/s3-request-presigner](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
