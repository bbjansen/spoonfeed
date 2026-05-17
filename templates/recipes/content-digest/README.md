# Content Digest

Implements [RFC 9530 — HTTP Content Digest](https://datatracker.ietf.org/doc/html/rfc9530) for payload integrity verification via digest headers.

## How it works

### Response digest (interceptor)

`ContentDigestInterceptor` hashes the serialized JSON response body with SHA-256 and sets both `Content-Digest` and `Repr-Digest` headers on every non-empty response.

### Request verification (guard)

`ContentDigestGuard` optionally validates inbound requests. If a `Content-Digest` header is present, the guard recomputes the hash and rejects the request with `400 Bad Request` when the digest does not match.

## Setup

Register the interceptor globally and apply the guard where needed:

```typescript
import { ContentDigestInterceptor } from '@/shared/interceptors/content-digest.interceptor';
import { ContentDigestGuard } from '@/shared/guards/content-digest.guard';

app.useGlobalInterceptors(new ContentDigestInterceptor());
```

## References

- [RFC 9530 — Digest Fields](https://datatracker.ietf.org/doc/html/rfc9530)
