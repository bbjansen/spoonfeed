import {
  AuditInterceptor,
  AuditEntry,
} from '../../../../src/shared/interceptors/audit.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

function createMockExecutionContext(overrides: {
  method: string;
  params?: Record<string, string>;
  user?: { sub: string };
  ip?: string;
  className?: string;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: overrides.method,
        params: overrides.params ?? {},
        user: overrides.user,
        ip: overrides.ip ?? '127.0.0.1',
      }),
    }),
    getClass: () => ({ name: overrides.className ?? 'TestController' }),
  } as unknown as ExecutionContext;
}

function createMockCallHandler(response: unknown = {}): CallHandler {
  return { handle: () => of(response) };
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    interceptor = new AuditInterceptor();
  });

  it('should capture an audit entry for a POST request', (done) => {
    const context = createMockExecutionContext({
      method: 'POST',
      params: { id: '42' },
      user: { sub: 'user-1' },
    });

    interceptor.intercept(context, createMockCallHandler()).subscribe(() => {
      const entries = interceptor.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(
        expect.objectContaining({
          action: 'POST',
          entityId: '42',
          userId: 'user-1',
          entityName: 'TestController',
        }),
      );
      done();
    });
  });

  it('should not capture an entry for a GET request', (done) => {
    const context = createMockExecutionContext({ method: 'GET' });

    interceptor.intercept(context, createMockCallHandler()).subscribe(() => {
      expect(interceptor.getEntries()).toHaveLength(0);
      done();
    });
  });

  it('should default userId to null when no user is present', (done) => {
    const context = createMockExecutionContext({ method: 'DELETE' });

    interceptor.intercept(context, createMockCallHandler()).subscribe(() => {
      const entries = interceptor.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBeNull();
      done();
    });
  });
});
