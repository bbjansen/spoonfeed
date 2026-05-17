import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

const IDEMPOTENCY_HEADER = 'idempotency-key';

interface CachedResponse {
  statusCode: number;
  body: unknown;
  timestamp: number;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);
  private readonly cache = new Map<string, CachedResponse>();
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    const request = req as unknown as FastifyRequest;
    const method = request.method?.toUpperCase();

    if (method !== 'POST' && method !== 'PUT') {
      next();
      return;
    }

    const idempotencyKey = request.headers[IDEMPOTENCY_HEADER] as string | undefined;

    if (!idempotencyKey) {
      next();
      return;
    }

    const cached = this.cache.get(idempotencyKey);
    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      this.logger.debug(`Replaying cached response for key: ${idempotencyKey}`);
      res.statusCode = cached.statusCode;
      res.setHeader('content-type', 'application/json');
      res.setHeader('x-idempotent-replayed', 'true');
      res.end(JSON.stringify(cached.body));
      return;
    }

    const originalEnd = res.end.bind(res);
    let responseBody = '';

    res.end = ((chunk: any, ...args: any[]) => {
      if (chunk) responseBody += chunk.toString();
      try {
        this.cache.set(idempotencyKey, {
          statusCode: res.statusCode,
          body: JSON.parse(responseBody),
          timestamp: Date.now(),
        });
      } catch {
        // Non-JSON response, skip caching
      }
      return originalEnd(chunk, ...args);
    }) as any;

    next();
  }
}
