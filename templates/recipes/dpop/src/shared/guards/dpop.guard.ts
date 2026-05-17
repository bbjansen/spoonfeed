import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import * as jose from 'jose';

@Injectable()
export class DPoPGuard implements CanActivate {
  private readonly logger = new Logger(DPoPGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const dpopHeader = request.headers['dpop'] as string | undefined;
    const authHeader = request.headers.authorization;

    if (!dpopHeader) {
      throw new UnauthorizedException('Missing DPoP proof header');
    }

    if (!authHeader?.startsWith('DPoP ')) {
      throw new UnauthorizedException('Authorization header must use DPoP scheme');
    }

    try {
      const { protectedHeader, payload } = await jose.jwtVerify(
        dpopHeader,
        async (header) => {
          if (!header.jwk) throw new Error('DPoP proof must contain jwk in header');
          return jose.importJWK(header.jwk);
        },
        {
          typ: 'dpop+jwt',
          maxTokenAge: '300s',
        },
      );

      if (payload.htm !== request.method) {
        throw new Error('DPoP htm does not match request method');
      }

      const expectedUri = `${request.protocol}://${request.hostname}${request.url.split('?')[0]}`;
      if (payload.htu !== expectedUri) {
        throw new Error('DPoP htu does not match request URI');
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `DPoP validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid DPoP proof');
    }
  }
}
