import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { createHash } from 'node:crypto';
import { ContentDigestInterceptor } from '@/shared/interceptors/content-digest.interceptor';

describe('ContentDigestInterceptor', () => {
  let interceptor: ContentDigestInterceptor;

  beforeEach(() => {
    interceptor = new ContentDigestInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should set Content-Digest and Repr-Digest headers on the response', (done) => {
    const responseBody = { id: 1, name: 'test' };
    const expectedHash = createHash('sha-256')
      .update(JSON.stringify(responseBody))
      .digest('base64');

    const headerFn = jest.fn();
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ header: headerFn }),
      }),
    } as unknown as ExecutionContext;

    const next = { handle: () => of(responseBody) };

    interceptor.intercept(context, next).subscribe(() => {
      expect(headerFn).toHaveBeenCalledWith('Content-Digest', `sha-256=:${expectedHash}:`);
      expect(headerFn).toHaveBeenCalledWith('Repr-Digest', `sha-256=:${expectedHash}:`);
      done();
    });
  });

  it('should not set headers when the response body is null or undefined', (done) => {
    const headerFn = jest.fn();
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ header: headerFn }),
      }),
    } as unknown as ExecutionContext;

    const next = { handle: () => of(null) };

    interceptor.intercept(context, next).subscribe(() => {
      expect(headerFn).not.toHaveBeenCalled();
      done();
    });
  });
});
