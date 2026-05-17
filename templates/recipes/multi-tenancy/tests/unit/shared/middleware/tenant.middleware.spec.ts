import { UnauthorizedException } from '@nestjs/common';
import { TenantMiddleware, getTenantContext } from '@/shared/middleware/tenant.middleware';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;

  beforeEach(() => {
    middleware = new TenantMiddleware();
  });

  it('should set tenant context when x-tenant-id header is present', (done) => {
    const req = { headers: { 'x-tenant-id': 'tenant-abc' } } as any;
    const res = {} as any;

    middleware.use(req, res, () => {
      const context = getTenantContext();
      expect(context).toBeDefined();
      expect(context!.tenantId).toBe('tenant-abc');
      done();
    });
  });

  it('should throw UnauthorizedException when x-tenant-id header is missing', () => {
    const req = { headers: {} } as any;
    const res = {} as any;

    expect(() => middleware.use(req, res, jest.fn())).toThrow(UnauthorizedException);
  });
});
