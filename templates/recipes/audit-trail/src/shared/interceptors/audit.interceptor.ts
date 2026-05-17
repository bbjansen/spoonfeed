import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';

export interface AuditEntry {
  userId: string | null;
  action: string;
  entityName: string;
  entityId: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  timestamp: Date;
  ip: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly entries: AuditEntry[] = [];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method;

    return next.handle().pipe(
      tap((response) => {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          this.entries.push({
            userId: (request as any).user?.sub ?? null,
            action: method,
            entityName: context.getClass().name,
            entityId: (request.params as any)?.id ?? 'unknown',
            changes: {},
            timestamp: new Date(),
            ip: request.ip,
          });
        }
      }),
    );
  }

  getEntries(): AuditEntry[] {
    return [...this.entries];
  }
}
