import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ContentDigestGuard } from '@/shared/guards/content-digest.guard';

describe('ContentDigestGuard', () => {
  let guard: ContentDigestGuard;

  function createMockContext(body: unknown, digestHeader?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'content-digest': digestHeader,
          },
          body,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new ContentDigestGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when no Content-Digest header is present', () => {
    const context = createMockContext({ foo: 'bar' }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when the digest matches the body', () => {
    const body = { message: 'hello' };
    const hash = createHash('sha-256').update(JSON.stringify(body)).digest('base64');
    const context = createMockContext(body, `sha-256=:${hash}:`);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw BadRequestException when the digest does not match', () => {
    const body = { message: 'hello' };
    const context = createMockContext(body, 'sha-256=:aW52YWxpZA==:');

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
    expect(() => guard.canActivate(context)).toThrow('Content-Digest mismatch');
  });

  it('should throw BadRequestException for an invalid header format', () => {
    const context = createMockContext({ a: 1 }, 'md5=abc123');

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
    expect(() => guard.canActivate(context)).toThrow('Invalid Content-Digest header format');
  });
});
