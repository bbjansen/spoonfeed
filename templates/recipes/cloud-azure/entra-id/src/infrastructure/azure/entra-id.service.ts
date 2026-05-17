import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConfidentialClientApplication,
  AuthenticationResult,
  Configuration,
} from '@azure/msal-node';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

@Injectable()
export class EntraIdService {
  private readonly logger = new Logger(EntraIdService.name);
  private readonly msalClient: ConfidentialClientApplication;
  private readonly tenantId: string;

  constructor(private readonly config: ConfigService) {
    this.tenantId = this.config.getOrThrow<string>('AZURE_TENANT_ID');

    const msalConfig: Configuration = {
      auth: {
        clientId: this.config.getOrThrow<string>('AZURE_CLIENT_ID'),
        clientSecret: this.config.getOrThrow<string>('AZURE_CLIENT_SECRET'),
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
      },
    };

    this.msalClient = new ConfidentialClientApplication(msalConfig);
  }

  async acquireToken(scopes: string[]): Promise<AuthenticationResult | null> {
    const result = await this.msalClient.acquireTokenByClientCredential({ scopes });
    this.logger.log('Token acquired via client credentials');
    return result;
  }

  async validateToken(token: string): Promise<jwt.JwtPayload> {
    const jwks = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${this.tenantId}/discovery/v2.0/keys`,
    });

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new Error('Invalid token: unable to decode');
    }

    const key = await jwks.getSigningKey(decoded.header.kid);
    const publicKey = key.getPublicKey();

    return jwt.verify(token, publicKey, {
      audience: this.config.getOrThrow<string>('AZURE_CLIENT_ID'),
      issuer: `https://login.microsoftonline.com/${this.tenantId}/v2.0`,
    }) as jwt.JwtPayload;
  }
}
