# Identity Recipes

Social login, authentication flows, multi-factor authentication, and role-based access control for NestJS.

## Available Recipes

| Recipe       | Mechanism                        | Best For                                      | Recipe README                                                           |
| ------------ | -------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| OAuth Google | Passport + Google OAuth 2.0      | Consumer apps, Google Workspace SSO           | [oauth-google](../../packages/templates/recipes/oauth-google/README.md) |
| OAuth GitHub | Passport + GitHub OAuth          | Developer-facing apps, open-source dashboards | [oauth-github](../../packages/templates/recipes/oauth-github/README.md) |
| OAuth Apple  | Passport + Sign in with Apple    | iOS/macOS apps, App Store compliance          | [oauth-apple](../../packages/templates/recipes/oauth-apple/README.md)   |
| Auth Flows   | Signup, verify email, reset pwd  | Any app requiring email-based registration    | [auth-flows](../../packages/templates/recipes/auth-flows/README.md)     |
| MFA / TOTP   | TOTP-based 2FA with backup codes | Security-sensitive apps, compliance           | [mfa-totp](../../packages/templates/recipes/mfa-totp/README.md)         |
| RBAC (CASL)  | CASL ability factory             | Fine-grained, attribute-based authorization   | [rbac-casl](../../packages/templates/recipes/rbac-casl/README.md)       |

## When to Use Each

- **Social OAuth** — reduce registration friction by letting users sign in with existing accounts. Pick the provider your audience already uses.
- **Auth Flows** — pair with JWT or Passport for full email/password lifecycle (signup, verification, password reset).
- **MFA / TOTP** — add a second factor for admin panels, financial apps, or any compliance requirement (PCI-DSS, SOC 2).
- **RBAC (CASL)** — go beyond simple role checks with attribute-level permissions (e.g. "editors can update only their own posts").

## Comparison

| Feature              | Social OAuth        | Auth Flows          | MFA / TOTP          | RBAC (CASL)     |
| -------------------- | ------------------- | ------------------- | ------------------- | --------------- |
| User friction        | Very low            | Medium              | Higher (setup)      | Transparent     |
| Password management  | Delegated           | Your responsibility | N/A (second factor) | N/A             |
| Compliance           | Provider-dependent  | Standard            | SOC 2, PCI-DSS      | GDPR, HIPAA     |
| Implementation scope | Strategy + callback | Service + emails    | QR setup + verify   | Ability factory |

## Quick Start: Google OAuth

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    const user = {
      email: profile.emails[0].value,
      displayName: profile.displayName,
      provider: 'google',
    };
    done(null, user);
  }
}
```

## External Documentation

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [passport-google-oauth20](https://www.npmjs.com/package/passport-google-oauth20)
- [passport-github2](https://www.npmjs.com/package/passport-github2)
- [CASL Documentation](https://casl.js.org/v6/en/)
- [RFC 6238 — TOTP](https://www.rfc-editor.org/rfc/rfc6238)
