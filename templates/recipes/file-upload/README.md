# File Upload

Multipart file upload with validation and streaming for Fastify-based NestJS applications.

## Links

- [@fastify/multipart on npm](https://www.npmjs.com/package/@fastify/multipart)
- [@fastify/multipart on GitHub](https://github.com/fastify/fastify-multipart)
- [NestJS File Upload (Fastify)](https://docs.nestjs.com/techniques/file-upload#default-options-fastify)
- [Presigned URL pattern for S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)

## Dependencies

| Package              | Version | Purpose                                 |
| -------------------- | ------- | --------------------------------------- |
| `@fastify/multipart` | `9.0.3` | Multipart/form-data parsing for Fastify |

## Environment Variables

| Variable           | Default | Description           |
| ------------------ | ------- | --------------------- |
| `MAX_FILE_SIZE_MB` | `50`    | Max upload size in MB |

## Setup

Register the multipart plugin in `main.ts`:

```typescript
import multipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  await app.register(multipart, {
    limits: { fileSize: Number(process.env.MAX_FILE_SIZE_MB ?? 50) * 1024 * 1024 },
  });

  await app.listen(3000, '0.0.0.0');
}
```

## Usage

### Basic file upload

```typescript
@Controller('files')
export class FileController {
  @Post('upload')
  @UseInterceptors(FileUploadInterceptor)
  async upload(@Req() req: FastifyRequest) {
    const file = (req as any).uploadedFile as UploadedFile;
    // Process the file stream
    return { filename: file.filename, mimetype: file.mimetype };
  }
}
```

### With validation

```typescript
@Post('upload')
@UseInterceptors(FileUploadInterceptor)
async upload(@Req() req: FastifyRequest) {
  const pipe = new FileValidationPipe({
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  });

  const file = pipe.transform((req as any).uploadedFile);
  // file is validated — process the stream
}
```

### Streaming to storage

```typescript
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

@Post('upload')
@UseInterceptors(FileUploadInterceptor)
async upload(@Req() req: FastifyRequest) {
  const file = (req as any).uploadedFile as UploadedFile;
  await pipeline(file.file, createWriteStream(`./uploads/${file.filename}`));
  return { saved: file.filename };
}
```

### Presigned URL pattern

For large files, prefer presigned URLs to avoid proxying through the application server:

1. Client requests a presigned upload URL from your API
2. Client uploads directly to the storage backend (S3, GCS, Azure Blob)
3. Client notifies your API that the upload is complete
4. API verifies the upload and processes metadata

## Generated Files

| File                                                 | Description                                  |
| ---------------------------------------------------- | -------------------------------------------- |
| `src/shared/pipes/file-validation.pipe.ts`           | Validates file MIME type and size            |
| `src/shared/interceptors/file-upload.interceptor.ts` | Extracts multipart file from Fastify request |
