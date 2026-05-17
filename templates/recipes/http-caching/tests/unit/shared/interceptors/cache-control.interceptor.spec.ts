import { CacheControlInterceptor } from '@/shared/interceptors/cache-control.interceptor';
import { CACHE_CONTROL_KEY } from '@/shared/decorators/cache-control.decorator';
import { of } from 'rxjs';

describe('CacheControlInterceptor', () => {
  let interceptor: CacheControlInterceptor;
  let reflector: { get: jest.Mock };

  beforeEach(() => {
    reflector = { get: jest.fn() };
    interceptor = new CacheControlInterceptor(reflector as any);
  });

  it('should pass through without setting headers when no CacheControl metadata exists', (done) => {
    reflector.get.mockReturnValue(undefined);
    const context = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn(),
    } as any;
    const next = { handle: () => of('data') };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toBe('data');
      done();
    });
  });

  it('should set Cache-Control header with the configured directives', (done) => {
    reflector.get.mockReturnValue({ public: true, maxAge: 3600 });
    const headerFn = jest.fn();
    const context = {
      getHandler: jest.fn(),
      switchToHttp: () => ({
        getResponse: () => ({ header: headerFn }),
      }),
    } as any;
    const next = { handle: () => of('data') };

    interceptor.intercept(context, next).subscribe(() => {
      expect(headerFn).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
      done();
    });
  });
});
