# Authentication Recipes

Authentication strategies for NestJS. Protect endpoints with JWT tokens, Passport strategies, or API keys.

## Available Recipes

| Recipe   | Strategy                            | Best For                                     | Recipe README                                                   |
| -------- | ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| JWT Auth | Bearer token                        | SPAs, mobile apps, stateless APIs            | [jwt-auth](../../packages/templates/recipes/jwt-auth/README.md) |
| Passport | Strategy-based (local, OAuth, SAML) | Multi-provider auth, SSO                     | [passport](../../packages/templates/recipes/passport/README.md) |
| API Keys | Static key in header                | Service-to-service, third-party integrations | [api-keys](../../packages/templates/recipes/api-keys/README.md) |

## Comparison

| Feature        | JWT                    | Passport                | API Keys           |
| -------------- | ---------------------- | ----------------------- | ------------------ |
| Statefulness   | Stateless              | Depends on strategy     | Stateless          |
| Token expiry   | Built-in (`exp` claim) | Strategy-dependent      | Manual rotation    |
| Revocation     | Requires denylist      | Session-based           | Delete from store  |
| Multi-provider | No (single issuer)     | Yes (strategies)        | No                 |
| Complexity     | Low                    | Medium                  | Low                |
| Best for       | User-facing APIs       | Web apps with OAuth/SSO | Machine-to-machine |

## Quick Start: JWT

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

```typescript
// jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  validate(payload: { sub: string; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

```typescript
// usage in controller
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('profile')
export class ProfileController {
  @Get()
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req) {
    return req.user;
  }
}
```

## External Documentation

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [NestJS Authorization](https://docs.nestjs.com/security/authorization)
- [@nestjs/jwt](https://www.npmjs.com/package/@nestjs/jwt)
- [@nestjs/passport](https://www.npmjs.com/package/@nestjs/passport)
- [passport-jwt](https://www.npmjs.com/package/passport-jwt)
