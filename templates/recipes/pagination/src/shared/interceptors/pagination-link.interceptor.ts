import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyReply, FastifyRequest } from 'fastify';
import { buildPaginationLinks } from '../dto/pagination.dto';

@Injectable()
export class PaginationLinkInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'pagination' in data) {
          const pagination = (data as any).pagination;
          const request = context.switchToHttp().getRequest<FastifyRequest>();
          const response = context.switchToHttp().getResponse<FastifyReply>();
          const baseUrl = `${request.protocol}://${request.hostname}${request.url.split('?')[0]}`;

          const linkHeader = buildPaginationLinks(
            baseUrl,
            pagination.page,
            pagination.pageSize,
            pagination.totalPages,
          );

          void response.header('Link', linkHeader);
        }
        return data;
      }),
    );
  }
}
