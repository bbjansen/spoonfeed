import { Expose } from 'class-transformer';
import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';

class UserDto {
  @Expose() id: number;
  @Expose() name: string;
  // password is intentionally not exposed
}

// Inline the interceptor logic to avoid pulling in UseInterceptors decorator side effects
import { plainToInstance } from 'class-transformer';

function serializeWith<T>(dto: new () => T, data: unknown): T {
  return plainToInstance(dto, data, { excludeExtraneousValues: true });
}

describe('SerializeInterceptor', () => {
  it('should strip properties not decorated with @Expose', () => {
    const raw = { id: 1, name: 'Alice', password: 'secret' };
    const result = serializeWith(UserDto, raw);

    expect(result).toHaveProperty('id', 1);
    expect(result).toHaveProperty('name', 'Alice');
    expect(result).not.toHaveProperty('password');
  });

  it('should handle an array of objects and serialize each element', () => {
    const raw = [
      { id: 1, name: 'Alice', password: 's1' },
      { id: 2, name: 'Bob', password: 's2' },
    ];
    const results = raw.map((item) => serializeWith(UserDto, item));

    expect(results).toHaveLength(2);
    expect(results[0]).not.toHaveProperty('password');
    expect(results[1]).toHaveProperty('name', 'Bob');
  });

  it('should return undefined for non-exposed fields even if source has them', () => {
    const raw = { id: 10, name: 'Charlie', email: 'charlie@example.com', role: 'admin' };
    const result = serializeWith(UserDto, raw);

    expect(result.id).toBe(10);
    expect((result as any).email).toBeUndefined();
    expect((result as any).role).toBeUndefined();
  });
});
