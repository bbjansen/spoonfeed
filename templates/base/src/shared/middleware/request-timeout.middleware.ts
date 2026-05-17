import { Injectable, NestMiddleware, RequestTimeoutException } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class RequestTimeoutMiddleware implements NestMiddleware {
  private readonly timeoutMs: number;

  constructor() {
    this.timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000);
  }

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    const timer = setTimeout(() => {
      if (!res.writableEnded) {
        res.statusCode = 408;
        res.end(
          JSON.stringify({
            type: 'urn:error:request-timeout',
            title: 'Request Timeout',
            status: 408,
            detail: 'Request processing exceeded the time limit',
            instance: (req as any).url,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }, this.timeoutMs);

    res.on('close', () => clearTimeout(timer));
    next();
  }
}
