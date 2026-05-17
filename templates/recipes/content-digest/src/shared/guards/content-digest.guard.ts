import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { FastifyRequest } from 'fastify';

@Injectable()
export class ContentDigestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const digestHeader = request.headers['content-digest'] as string | undefined;

    if (!digestHeader) return true; // Optional — only verify if provided

    const match = digestHeader.match(/sha-256=:([^:]+):/);
    if (!match) throw new BadRequestException('Invalid Content-Digest header format');

    const expectedHash = match[1];
    const body = JSON.stringify(request.body);
    const actualHash = createHash('sha-256').update(body).digest('base64');

    if (expectedHash !== actualHash) {
      throw new BadRequestException('Content-Digest mismatch — payload integrity check failed');
    }

    return true;
  }
}
