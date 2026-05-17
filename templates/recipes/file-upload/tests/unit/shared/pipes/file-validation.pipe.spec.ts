import { BadRequestException } from '@nestjs/common';
import { FileValidationPipe, UploadedFile } from '@/shared/pipes/file-validation.pipe';

describe('FileValidationPipe', () => {
  function createFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
    return {
      filename: 'test.png',
      mimetype: 'image/png',
      encoding: '7bit',
      file: {} as NodeJS.ReadableStream,
      fieldname: 'file',
      ...overrides,
    };
  }

  it('should pass through a file with a valid default mime type', () => {
    const pipe = new FileValidationPipe();
    const file = createFile({ mimetype: 'image/jpeg' });

    const result = pipe.transform(file);
    expect(result).toBe(file);
  });

  it('should throw BadRequestException when no file is provided', () => {
    const pipe = new FileValidationPipe();
    expect(() => pipe.transform(null as any)).toThrow(BadRequestException);
    expect(() => pipe.transform(null as any)).toThrow('No file uploaded');
  });

  it('should throw BadRequestException for a disallowed mime type', () => {
    const pipe = new FileValidationPipe();
    const file = createFile({ mimetype: 'application/zip' });

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow('File type application/zip is not allowed');
  });

  it('should accept custom allowed mime types', () => {
    const pipe = new FileValidationPipe({
      allowedMimeTypes: ['text/csv'],
    });
    const file = createFile({ mimetype: 'text/csv' });

    const result = pipe.transform(file);
    expect(result).toBe(file);
  });

  it('should reject default-allowed types when custom list overrides them', () => {
    const pipe = new FileValidationPipe({
      allowedMimeTypes: ['text/csv'],
    });
    const file = createFile({ mimetype: 'image/png' });

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });
});
