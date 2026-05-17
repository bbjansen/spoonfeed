# File Handling Recipes

Multipart file upload, validation, and streaming for NestJS applications.

## Available Recipes

| Recipe      | Approach                         | Best For                                  | Recipe README                                                         |
| ----------- | -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| File Upload | Fastify multipart with streaming | Avatar uploads, document ingestion, media | [file-upload](../../packages/templates/recipes/file-upload/README.md) |

## When to Use

- **User-generated content** — profile pictures, document uploads, media attachments.
- **Bulk imports** — CSV or Excel files processed server-side.
- **Streaming large files** — avoid loading entire files into memory by piping to S3 or disk.

Pair with the [S3/MinIO recipe](../../packages/templates/recipes/s3-minio/README.md) to persist uploaded files to object storage.

## Upload Strategies

| Strategy           | Memory Usage | Max File Size | Best For                      |
| ------------------ | ------------ | ------------- | ----------------------------- |
| Buffer (in-memory) | High         | ~10 MB        | Small files, quick processing |
| Disk storage       | Low          | ~1 GB         | Temporary processing          |
| Stream to S3       | Very low     | Unlimited     | Production file storage       |

## Quick Start

```typescript
import { Controller, Post, UseInterceptors, UploadedFile, ParseFilePipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('files')
export class FilesController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
```

## Validation Checklist

- Restrict allowed MIME types to prevent executable uploads.
- Enforce a maximum file size to protect memory and disk.
- Sanitise filenames to avoid path-traversal attacks.
- Scan uploads with an antivirus service in security-sensitive environments.
- Store files outside the web root or in object storage (S3, GCS, Azure Blob).

## External Documentation

- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)
- [@fastify/multipart](https://www.npmjs.com/package/@fastify/multipart)
- [Multer](https://www.npmjs.com/package/multer)
