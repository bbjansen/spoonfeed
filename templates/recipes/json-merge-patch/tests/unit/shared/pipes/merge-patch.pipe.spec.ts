import { BadRequestException } from '@nestjs/common';
import { MergePatchValidationPipe } from '@/shared/pipes/merge-patch.pipe';

describe('MergePatchValidationPipe', () => {
  let pipe: MergePatchValidationPipe;

  beforeEach(() => {
    pipe = new MergePatchValidationPipe();
  });

  it('should accept a valid plain object', () => {
    const body = { name: 'updated', age: null };

    const result = pipe.transform(body);

    expect(result).toEqual(body);
  });

  it('should throw BadRequestException when body is null', () => {
    expect(() => pipe.transform(null)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when body is an array', () => {
    expect(() => pipe.transform([1, 2, 3])).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when body is a primitive', () => {
    expect(() => pipe.transform('string-value')).toThrow(BadRequestException);
  });
});
