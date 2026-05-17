import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class PreferInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const prefer = this.parsePrefer(request.headers['prefer'] as string);

    return next.handle().pipe(
      map((data) => {
        const applied: string[] = [];

        if (prefer.has('return')) {
          const returnPref = prefer.get('return');
          if (returnPref === 'minimal') {
            applied.push('return=minimal');
            void response.code(204);
            return undefined;
          }
          if (returnPref === 'representation') {
            applied.push('return=representation');
          }
        }

        if (prefer.has('respond-async')) {
          applied.push('respond-async');
          // Signal to the handler that async processing was requested
          // The handler should return 202 Accepted with a polling URL
        }

        if (applied.length > 0) {
          void response.header('Preference-Applied', applied.join(', '));
        }

        return data;
      }),
    );
  }

  private parsePrefer(header: string | undefined): Map<string, string> {
    const preferences = new Map<string, string>();
    if (!header) return preferences;

    for (const part of header.split(',')) {
      const trimmed = part.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        preferences.set(trimmed.slice(0, eqIndex).trim(), trimmed.slice(eqIndex + 1).trim());
      } else {
        preferences.set(trimmed, '');
      }
    }

    return preferences;
  }
}
