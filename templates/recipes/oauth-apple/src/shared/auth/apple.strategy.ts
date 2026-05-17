import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-apple';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('APPLE_CLIENT_ID'),
      teamID: configService.getOrThrow<string>('APPLE_TEAM_ID'),
      keyID: configService.getOrThrow<string>('APPLE_KEY_ID'),
      privateKeyPath: configService.getOrThrow<string>('APPLE_PRIVATE_KEY_PATH'),
      callbackURL: configService.getOrThrow<string>('APPLE_CALLBACK_URL'),
      scope: ['name', 'email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    decodedIdToken: { sub: string; email?: string },
    done: (err: Error | null, user?: Record<string, unknown>) => void,
  ): void {
    const user = {
      provider: 'apple',
      providerId: decodedIdToken.sub,
      email: decodedIdToken.email,
      accessToken,
    };
    done(null, user);
  }
}
