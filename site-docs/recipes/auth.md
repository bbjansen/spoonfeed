# Authentication Recipes

spoonfeed provides 11 authentication and authorization recipes covering JWT, Passport strategies, OAuth providers, RBAC, MFA, and token proof-of-possession. Start with `jwt-auth` for most REST APIs, add `rbac-casl` for fine-grained permissions, and layer on OAuth providers or MFA as needed.

!!! tip "Recommended combinations"
    - **Standard API auth:** `jwt-auth` + `rbac-casl` + `auth-flows`
    - **Social login:** `jwt-auth` + one or more OAuth recipes (`oauth-google`, `oauth-github`, `oauth-apple`)
    - **Enterprise SSO:** `oauth2-introspection` or `aws-cognito` or `azure-entra-id`
    - **High-security apps:** `jwt-auth` + `mfa-totp` + `dpop` + `throttler`

---

## JWT Authentication

JWT-based authentication with Passport. The most common auth pattern for REST APIs.

| | |
| --- | --- |
| **ID** | `jwt-auth` |
| **Dependencies** | `@nestjs/jwt` `@nestjs/passport` `passport-jwt` |
| **Dev dependencies** | `@types/passport-jwt` |
| **Compatible with** | HTTP API, AWS Lambda, Microservice, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
| `JWT_EXPIRES_IN` | `3600s` | JWT token expiration |

**Usage:** Apply `@UseGuards(JwtAuthGuard)` to protected routes. Access the authenticated user with `@CurrentUser()` parameter decorator. Use `@Public()` to opt out of JWT validation on specific routes.

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/shared/guards/jwt-auth.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { Public } from '@/shared/decorators/public.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  @Get('me')
  getProfile(@CurrentUser() user: { id: string; email: string }) {
    return user;
  }

  @Get('me/email')
  getEmail(@CurrentUser('email') email: string) {
    return { email };
  }

  @Public()
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }
}
```

!!! note
    Set `JWT_SECRET` to a strong, unique value in production. The default `change-me-in-production` value is rejected by `config-validation` if that recipe is enabled.

**Pairs well with:** `rbac-casl`, `auth-flows`, `mfa-totp`, `throttler`

---

## Passport Strategies

Passport.js with local (username/password) and JWT strategies.

| | |
| --- | --- |
| **ID** | `passport` |
| **Dependencies** | `@nestjs/passport` `passport-local` `passport-jwt` |
| **Dev dependencies** | `@types/passport-local` `@types/passport-jwt` |
| **Compatible with** | HTTP API, AWS Lambda, Microservice, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |

**Usage:** Local strategy handles username/password login. JWT strategy validates bearer tokens. Create custom strategies by extending `PassportStrategy(Strategy)`.

---

## Auth Flows

Complete signup, email verification, and password reset flows built on JWT.

| | |
| --- | --- |
| **ID** | `auth-flows` |
| **Dependencies** | `@nestjs/jwt` `bcrypt` `uuid` |
| **Dev dependencies** | `@types/bcrypt` |
| **Requires** | `jwt-auth` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_JWT_SECRET` | `change-me-in-production` | JWT secret for auth flow tokens |
| `AUTH_EMAIL_VERIFICATION_URL` | `http://localhost:3000/verify-email` | Email verification link base URL |
| `AUTH_PASSWORD_RESET_URL` | `http://localhost:3000/reset-password` | Password reset link base URL |

**Usage:** `AuthService` handles signup, login, email verification, and password reset. Passwords are hashed with bcrypt. Wire in your own `UserRepository` and email transport.

**Pairs well with:** `jwt-auth`, `nodemailer` or `sendgrid` (for verification and reset emails)

---

## API Key Authentication

API key-based authentication with a custom guard for machine-to-machine communication.

| | |
| --- | --- |
| **ID** | `api-keys` |
| **Compatible with** | HTTP API, AWS Lambda, Microservice, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `API_KEY_HEADER` | `x-api-key` | Header name for API key |

**Usage:** Apply `@UseGuards(ApiKeyGuard)` to routes. API keys are validated against stored keys. Store only hashed keys in the database. Support key rotation with multiple active keys.

---

## OAuth 2.0 Token Introspection

RFC 7662 token introspection for validating opaque tokens against an authorization server.

| | |
| --- | --- |
| **ID** | `oauth2-introspection` |
| **Compatible with** | HTTP API, AWS Lambda, Microservice, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `OAUTH2_INTROSPECTION_URL` | `https://auth.example.com/oauth2/introspect` | Introspection endpoint URL |
| `OAUTH2_CLIENT_ID` | | OAuth 2.0 client ID |
| `OAUTH2_CLIENT_SECRET` | | OAuth 2.0 client secret |

**Usage:** Apply `TokenIntrospectionGuard` on routes that accept opaque OAuth tokens. JWT tokens should use the `jwt-auth` recipe instead.

---

## RBAC Authorization (CASL)

Role-based access control with CASL ability factory for fine-grained permissions.

| | |
| --- | --- |
| **ID** | `rbac-casl` |
| **Dependencies** | `@casl/ability` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** Use `@Roles(Role.Admin)` for simple role checks and `@CheckPolicies(handler)` for fine-grained CASL policies. The `CaslAbilityFactory` defines per-role permissions.

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/shared/guards/jwt-auth.guard';
import { RolesGuard } from '@/shared/guards/roles.guard';
import { Roles } from '@/shared/decorators/roles.decorator';
import { Role } from '@/shared/auth/casl-ability.factory';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('dashboard')
  @Roles(Role.Admin)
  getDashboard() {
    return { message: 'Admin dashboard' };
  }
}
```

**Pairs well with:** `jwt-auth`, `auth-flows`

---

## Google OAuth

Google OAuth 2.0 login via Passport.

| | |
| --- | --- |
| **ID** | `oauth-google` |
| **Dependencies** | `passport-google-oauth20` `@nestjs/passport` `passport` |
| **Dev dependencies** | `@types/passport-google-oauth20` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | | Google OAuth 2.0 client secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3000/auth/google/callback` | OAuth callback URL |

**Usage:** Apply `@UseGuards(GoogleAuthGuard)` to initiate login and handle the callback.

---

## GitHub OAuth

GitHub OAuth 2.0 login via Passport.

| | |
| --- | --- |
| **ID** | `oauth-github` |
| **Dependencies** | `passport-github2` `@nestjs/passport` `passport` |
| **Dev dependencies** | `@types/passport-github2` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | | GitHub OAuth App client secret |
| `GITHUB_CALLBACK_URL` | `http://localhost:3000/auth/github/callback` | OAuth callback URL |

**Usage:** Apply `@UseGuards(GitHubAuthGuard)` to initiate login and handle the callback.

---

## Apple OAuth

Sign in with Apple via Passport.

| | |
| --- | --- |
| **ID** | `oauth-apple` |
| **Dependencies** | `passport-apple` `@nestjs/passport` `passport` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `APPLE_CLIENT_ID` | | Apple Services ID |
| `APPLE_TEAM_ID` | | Apple Developer Team ID |
| `APPLE_KEY_ID` | | Apple Sign In private key ID |
| `APPLE_PRIVATE_KEY_PATH` | | Path to Apple Sign In private key (.p8) |
| `APPLE_CALLBACK_URL` | `http://localhost:3000/auth/apple/callback` | OAuth callback URL |

**Usage:** Apply `@UseGuards(AppleAuthGuard)` to initiate login and handle the callback.

!!! warning
    Apple only returns user name and email on the first authorization. Store this data immediately.

---

## Two-Factor Authentication (TOTP)

TOTP-based 2FA with backup codes using `otplib`.

| | |
| --- | --- |
| **ID** | `mfa-totp` |
| **Dependencies** | `otplib` `qrcode` |
| **Dev dependencies** | `@types/qrcode` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** Use `TotpService` to generate secrets (`generateSecret()`), QR codes (`generateQrCode()`), and verify tokens (`verify()`). Store backup codes hashed — they are single-use recovery codes.

---

## DPoP (Proof of Possession)

RFC 9449 Demonstrating Proof of Possession for OAuth tokens.

| | |
| --- | --- |
| **ID** | `dpop` |
| **Dependencies** | `jose` |
| **Compatible with** | HTTP API, Full-Stack, Monorepo |

**Usage:** `DPoPGuard` validates DPoP proof JWTs on protected endpoints. It checks the proof `typ`, `htm` (HTTP method), `htu` (request URI), and token age. Clients must send a `DPoP` header with a `dpop+jwt`.

**Pairs well with:** `jwt-auth`, `oauth2-introspection`
