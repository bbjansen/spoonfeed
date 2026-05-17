import { BadRequestException } from '@nestjs/common';
import { ParseUuidPipe } from '@/shared/pipes/parse-uuid.pipe';

describe('ParseUuidPipe', () => {
  const pipe = new ParseUuidPipe();

  it('should accept valid UUID', () => {
    expect(pipe.transform('550e8400-e29b-41d4-a716-446655440000')).toBeDefined();
  });

  it('should reject invalid string', () => {
    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
  });
});
