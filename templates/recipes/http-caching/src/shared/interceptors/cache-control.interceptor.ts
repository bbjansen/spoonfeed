import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyReply } from 'fastify';
import { CACHE_CONTROL_KEY, CacheControlOptions } from '../decorators/cache-control.decorator';

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<CacheControlOptions>(
      CACHE_CONTROL_KEY,
      context.getHandler(),
    );

    if (!options) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<FastifyReply>();
        const directives: string[] = [];

        if (options.public) directives.push('public');
        if (options.private) directives.push('private');
        if (options.noCache) directives.push('no-cache');
        if (options.noStore) directives.push('no-store');
        if (options.mustRevalidate) directives.push('must-revalidate');
        if (options.maxAge !== undefined) directives.push(`max-age=${options.maxAge}`);
        if (options.sMaxAge !== undefined) directives.push(`s-maxage=${options.sMaxAge}`);
        if (options.staleWhileRevalidate !== undefined)
          directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
        if (options.staleIfError !== undefined)
          directives.push(`stale-if-error=${options.staleIfError}`);

        if (directives.length > 0) {
          void response.header('Cache-Control', directives.join(', '));
        }
      }),
    );
  }
}
