import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface TenantContext {
  tenantId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

const TENANT_HEADER = 'x-tenant-id';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    const tenantId = req.headers[TENANT_HEADER] as string | undefined;

    if (!tenantId) {
      throw new UnauthorizedException(`Missing required header: ${TENANT_HEADER}`);
    }

    const context: TenantContext = { tenantId };

    tenantStorage.run(context, () => {
      next();
    });
  }
}

/**
 * Retrieve the current tenant context from anywhere in the async call chain.
 * Returns undefined if called outside of a request context.
 */
export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/**
 * Retrieve the current tenant ID or throw if not in a request context.
 */
export function requireTenantId(): string {
  const context = tenantStorage.getStore();

  if (!context) {
    throw new Error('Tenant context not available outside of a request');
  }

  return context.tenantId;
}
