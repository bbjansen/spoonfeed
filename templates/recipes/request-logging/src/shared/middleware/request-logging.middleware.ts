import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    const start = performance.now();
    const { method, url } = req;
    const userAgent = req.headers['user-agent'] || '-';
    const correlationId = req.headers['x-correlation-id'] || '-';

    res.on('finish', () => {
      const duration = (performance.now() - start).toFixed(2);
      const { statusCode } = res;
      const contentLength = res.getHeader('content-length') || 0;

      const logData = {
        method,
        url,
        statusCode,
        duration: `${duration}ms`,
        contentLength,
        userAgent,
        correlationId,
      };

      if (statusCode >= 500) {
        this.logger.error(logData);
      } else if (statusCode >= 400) {
        this.logger.warn(logData);
      } else {
        this.logger.log(logData);
      }
    });

    next();
  }
}
