import { PreferInterceptor } from '@/shared/interceptors/prefer.interceptor';
import { of } from 'rxjs';

describe('PreferInterceptor', () => {
  let interceptor: PreferInterceptor;

  beforeEach(() => {
    interceptor = new PreferInterceptor();
  });

  it('should return data unchanged when no Prefer header is present', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => ({ header: jest.fn(), code: jest.fn() }),
      }),
    } as any;
    const next = { handle: () => of({ id: 1 }) };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({ id: 1 });
      done();
    });
  });

  it('should return undefined and set status 204 when return=minimal is preferred', (done) => {
    const codeFn = jest.fn();
    const headerFn = jest.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { prefer: 'return=minimal' } }),
        getResponse: () => ({ header: headerFn, code: codeFn }),
      }),
    } as any;
    const next = { handle: () => of({ id: 1 }) };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toBeUndefined();
      expect(codeFn).toHaveBeenCalledWith(204);
      expect(headerFn).toHaveBeenCalledWith('Preference-Applied', 'return=minimal');
      done();
    });
  });
});
