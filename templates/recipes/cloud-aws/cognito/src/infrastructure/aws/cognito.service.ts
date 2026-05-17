import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

@Injectable()
export class CognitoService {
  private readonly client: CognitoIdentityProviderClient;
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;
  private readonly logger = new Logger(CognitoService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-1'),
    });

    this.verifier = CognitoJwtVerifier.create({
      userPoolId: this.configService.getOrThrow<string>('COGNITO_USER_POOL_ID'),
      clientId: this.configService.getOrThrow<string>('COGNITO_CLIENT_ID'),
      tokenUse: 'access',
    });
  }

  async verifyToken(token: string): Promise<Record<string, unknown>> {
    const payload = await this.verifier.verify(token);
    this.logger.debug(`Token verified for sub: ${payload.sub}`);
    return payload as unknown as Record<string, unknown>;
  }

  async getUser(accessToken: string): Promise<Record<string, string>> {
    const result = await this.client.send(new GetUserCommand({ AccessToken: accessToken }));

    const attributes: Record<string, string> = {};
    result.UserAttributes?.forEach((attr: AttributeType) => {
      if (attr.Name && attr.Value) {
        attributes[attr.Name] = attr.Value;
      }
    });

    this.logger.debug(`Retrieved user: ${result.Username}`);
    return attributes;
  }
}
