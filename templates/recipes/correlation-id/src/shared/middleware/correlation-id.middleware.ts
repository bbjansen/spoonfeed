import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { FastifyReply, FastifyRequest } from 'fastify';

const CORRELATION_HEADER = 'x-correlation-id';

export const correlationStorage = new AsyncLocalStorage<string>();

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    const incoming = req.headers[CORRELATION_HEADER] as string | undefined;
    const correlationId = incoming || crypto.randomUUID();

    res.setHeader(CORRELATION_HEADER, correlationId);

    correlationStorage.run(correlationId, () => {
      next();
    });
  }
}

/**
 * Retrieve the current correlation ID from anywhere in the async call chain.
 * Returns undefined if called outside of a request context.
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}
