import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from '@/shared/interceptors/response.interceptor';

const createMockCallHandler = <T>(value: T): CallHandler<T> =>
  ({ handle: () => of(value) }) as CallHandler<T>;

const mockContext = {} as ExecutionContext;

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  describe('intercept', () => {
    it('should wrap data in a data envelope', (done) => {
      const handler = createMockCallHandler({ id: 1, name: 'John' });

      interceptor.intercept(mockContext, handler).subscribe((result) => {
        expect(result).toStrictEqual({ data: { id: 1, name: 'John' } });
        done();
      });
    });

    it('should pass through undefined without wrapping', (done) => {
      const handler = createMockCallHandler(undefined);

      interceptor.intercept(mockContext, handler).subscribe((result) => {
        expect(result).toBeUndefined();
        done();
      });
    });

    it('should pass through null without wrapping', (done) => {
      const handler = createMockCallHandler(null);

      interceptor.intercept(mockContext, handler).subscribe((result) => {
        expect(result).toBeUndefined();
        done();
      });
    });

    it('should wrap array responses', (done) => {
      const handler = createMockCallHandler([{ id: 1 }, { id: 2 }]);

      interceptor.intercept(mockContext, handler).subscribe((result) => {
        expect(result).toStrictEqual({ data: [{ id: 1 }, { id: 2 }] });
        done();
      });
    });
  });
});
