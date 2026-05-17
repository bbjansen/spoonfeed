import { BadRequestException } from '@nestjs/common';
import { JsonPatchValidationPipe } from '@/shared/pipes/json-patch.pipe';

describe('JsonPatchValidationPipe', () => {
  let pipe: JsonPatchValidationPipe;

  beforeEach(() => {
    pipe = new JsonPatchValidationPipe();
  });

  it('should accept a valid array of patch operations', () => {
    const operations = [
      { op: 'replace', path: '/name', value: 'updated' },
      { op: 'add', path: '/age', value: 30 },
    ];

    const result = pipe.transform(operations);

    expect(result).toEqual(operations);
  });

  it('should throw BadRequestException when body is not an array', () => {
    expect(() => pipe.transform({ op: 'replace' })).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for an invalid operation type', () => {
    const operations = [{ op: 'invalid', path: '/name', value: 'x' }];

    expect(() => pipe.transform(operations)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when path does not start with /', () => {
    const operations = [{ op: 'replace', path: 'name', value: 'x' }];

    expect(() => pipe.transform(operations)).toThrow(BadRequestException);
  });
});
