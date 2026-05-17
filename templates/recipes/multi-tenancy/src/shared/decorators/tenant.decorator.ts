import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { tenantStorage } from '@/shared/middleware/tenant.middleware';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string => {
    const context = tenantStorage.getStore();

    if (!context) {
      throw new Error('Tenant context not available — is TenantMiddleware registered?');
    }

    return context.tenantId;
  },
);
