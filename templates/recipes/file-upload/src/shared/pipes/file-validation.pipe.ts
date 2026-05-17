import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export interface UploadedFile {
  filename: string;
  mimetype: string;
  encoding: string;
  file: NodeJS.ReadableStream;
  fieldname: string;
}

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly maxSize: number;
  private readonly allowedTypes: Set<string>;

  constructor(options: FileValidationOptions = {}) {
    this.maxSize = options.maxSizeBytes ?? 50 * 1024 * 1024;
    this.allowedTypes = new Set(
      options.allowedMimeTypes ?? [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    );
  }

  transform(file: UploadedFile): UploadedFile {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!this.allowedTypes.has(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }
    return file;
  }
}
