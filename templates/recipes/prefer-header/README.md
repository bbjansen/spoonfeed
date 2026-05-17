# Prefer Header Interceptor

Implementation of [RFC 7240 — Prefer Header for HTTP](https://datatracker.ietf.org/doc/html/rfc7240).

The `PreferInterceptor` parses the `Prefer` request header and adjusts responses accordingly. Applied preferences are echoed back via the `Preference-Applied` response header.

## Supported Preferences

### `return=minimal`

Returns `204 No Content` with an empty body, useful for clients that do not need the response payload after a mutation.

```http
POST /users HTTP/1.1
Content-Type: application/json
Prefer: return=minimal

{"name": "Alice"}
```

```http
HTTP/1.1 204 No Content
Preference-Applied: return=minimal
```

### `return=representation`

Returns the full resource representation in the response body (default behavior for most endpoints, but the header makes the intent explicit).

```http
PUT /users/1 HTTP/1.1
Content-Type: application/json
Prefer: return=representation

{"name": "Bob"}
```

```http
HTTP/1.1 200 OK
Preference-Applied: return=representation
Content-Type: application/json

{"id": 1, "name": "Bob", "createdAt": "2025-01-01T00:00:00Z"}
```

### `respond-async`

Signals that the client prefers asynchronous processing. The interceptor records the preference; the handler is responsible for returning `202 Accepted` with a polling URL when appropriate.

```http
POST /reports HTTP/1.1
Content-Type: application/json
Prefer: respond-async

{"type": "annual-summary"}
```

```http
HTTP/1.1 202 Accepted
Preference-Applied: respond-async
Location: /reports/jobs/42
Content-Type: application/json

{"jobId": 42, "status": "pending"}
```

## Registration

Register the interceptor globally in your application module or bootstrap file:

```typescript
import { PreferInterceptor } from '@/shared/interceptors/prefer.interceptor';

app.useGlobalInterceptors(new PreferInterceptor());
```

Or via a module provider:

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PreferInterceptor } from '@/shared/interceptors/prefer.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: PreferInterceptor,
    },
  ],
})
export class AppModule {}
```
