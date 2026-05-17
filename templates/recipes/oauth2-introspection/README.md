# OAuth 2.0 Token Introspection

Validates opaque OAuth 2.0 access tokens by calling a token introspection endpoint as defined in [RFC 7662](https://datatracker.ietf.org/doc/html/rfc7662).

## When to use

Use this recipe when your application receives **opaque** (non-JWT) access tokens that must be validated against an authorization server. If your tokens are self-contained JWTs, use the `jwt-auth` recipe instead.

## Environment variables

| Variable                   | Required | Default                                      | Description                           |
| -------------------------- | -------- | -------------------------------------------- | ------------------------------------- |
| `OAUTH2_INTROSPECTION_URL` | Yes      | `https://auth.example.com/oauth2/introspect` | Token introspection endpoint URL      |
| `OAUTH2_CLIENT_ID`         | Yes      | —                                            | OAuth 2.0 client ID for introspection |
| `OAUTH2_CLIENT_SECRET`     | Yes      | —                                            | OAuth 2.0 client secret               |

## Usage

Apply the guard to any controller or route that requires a valid OAuth 2.0 token:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { TokenIntrospectionGuard } from '@/shared/guards/token-introspection.guard';

@Controller('protected')
@UseGuards(TokenIntrospectionGuard)
export class ProtectedController {
  @Get()
  getProtectedResource() {
    return { message: 'You have a valid token' };
  }
}
```

Access the authenticated user information via the request object:

```typescript
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TokenIntrospectionGuard } from '@/shared/guards/token-introspection.guard';
import { FastifyRequest } from 'fastify';

@Controller('me')
@UseGuards(TokenIntrospectionGuard)
export class MeController {
  @Get()
  getProfile(@Req() request: FastifyRequest) {
    return (request as any).user;
  }
}
```

## How it works

1. Extracts the `Bearer` token from the `Authorization` header.
2. Sends a `POST` request to the introspection endpoint with the token and client credentials (HTTP Basic auth).
3. If the response indicates `active: true`, the guard attaches the token metadata (`sub`, `username`, `scope`, `clientId`) to `request.user`.
4. If the token is inactive or the introspection call fails, a `401 Unauthorized` response is returned.

## References

- [RFC 7662 - OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [NestJS Guards](https://docs.nestjs.com/guards)
