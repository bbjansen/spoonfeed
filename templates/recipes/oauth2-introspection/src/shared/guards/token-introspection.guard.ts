import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';

interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  sub?: string;
  exp?: number;
}

@Injectable()
export class TokenIntrospectionGuard implements CanActivate {
  private readonly logger = new Logger(TokenIntrospectionGuard.name);
  private readonly introspectionUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.introspectionUrl = this.configService.getOrThrow<string>('OAUTH2_INTROSPECTION_URL');
    this.clientId = this.configService.getOrThrow<string>('OAUTH2_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>('OAUTH2_CLIENT_SECRET');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const result = await this.introspect(token);

    if (!result.active) {
      throw new UnauthorizedException('Token is not active');
    }

    (request as any).user = {
      sub: result.sub,
      username: result.username,
      scope: result.scope,
      clientId: result.client_id,
    };

    return true;
  }

  private async introspect(token: string): Promise<IntrospectionResponse> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(this.introspectionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: `token=${encodeURIComponent(token)}`,
    });

    if (!response.ok) {
      this.logger.error(`Introspection endpoint returned ${response.status}`);
      throw new UnauthorizedException('Token introspection failed');
    }

    return (await response.json()) as IntrospectionResponse;
  }
}
