# DPoP (Demonstrating Proof of Possession)

Implements [RFC 9449 — OAuth 2.0 Demonstrating Proof of Possession (DPoP)](https://datatracker.ietf.org/doc/html/rfc9449) for binding access tokens to a client's key pair.

## How it works

`DPoPGuard` validates the `DPoP` proof JWT on protected endpoints. It checks:

- The proof JWT type is `dpop+jwt`
- The `htm` claim matches the HTTP method
- The `htu` claim matches the request URI
- The proof is not older than 300 seconds
- The `jwk` in the proof header is used to verify the signature

## Setup

Apply the guard to routes that require proof-of-possession tokens:

```typescript
import { DPoPGuard } from '@/shared/guards/dpop.guard';

@UseGuards(DPoPGuard)
@Get('protected')
getProtected() {
  return { message: 'Access granted with DPoP' };
}
```

Clients must:

1. Use the `DPoP` authorization scheme: `Authorization: DPoP <access_token>`
2. Include a `DPoP` header with a signed `dpop+jwt` proof

## References

- [RFC 9449 — OAuth 2.0 Demonstrating Proof of Possession (DPoP)](https://datatracker.ietf.org/doc/html/rfc9449)
- [jose](https://www.npmjs.com/package/jose) — JavaScript module for JSON Object Signing and Encryption
