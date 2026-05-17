# Security Recipes

Security hardening for NestJS applications. Rate limiting, HTTP headers, CORS, and CSRF protection.

## Available Recipes

| Recipe    | Purpose                               | Recipe README                                                     |
| --------- | ------------------------------------- | ----------------------------------------------------------------- |
| Throttler | Rate limiting per IP/user             | [throttler](../../packages/templates/recipes/throttler/README.md) |
| Helmet    | Secure HTTP headers                   | [helmet](../../packages/templates/recipes/helmet/README.md)       |
| CORS      | Cross-origin resource sharing         | [cors](../../packages/templates/recipes/cors/README.md)           |
| CSRF      | Cross-site request forgery protection | [csrf](../../packages/templates/recipes/csrf/README.md)           |

## Overview

| Layer          | Protection                            | Recipe    |
| -------------- | ------------------------------------- | --------- |
| Network        | Rate limiting, brute-force protection | Throttler |
| HTTP headers   | XSS, clickjacking, MIME sniffing      | Helmet    |
| Origin         | Block unauthorized domains            | CORS      |
| State mutation | Prevent forged form submissions       | CSRF      |

## Throttler (Rate Limiting)

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 }, // 3 requests per second
      { name: 'medium', ttl: 10000, limit: 20 }, // 20 requests per 10 seconds
      { name: 'long', ttl: 60000, limit: 100 }, // 100 requests per minute
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

## Helmet (HTTP Headers)

```typescript
// main.ts
import helmet from 'helmet';

const app = await NestFactory.create(AppModule);
app.use(helmet());
```

Headers set by Helmet include `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, and more.

## CORS

```typescript
// main.ts
const app = await NestFactory.create(AppModule);
app.enableCors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
});
```

## CSRF

For server-rendered applications or APIs that use cookies for authentication:

```typescript
import * as csurf from 'csurf';

app.use(csurf({ cookie: true }));
```

Note: CSRF protection is typically unnecessary for stateless JWT-based APIs since they do not use cookies.

## Recommended Defaults

| Environment | Throttler         | Helmet   | CORS               | CSRF             |
| ----------- | ----------------- | -------- | ------------------ | ---------------- |
| Development | Disabled          | Disabled | `origin: *`        | Disabled         |
| Staging     | Enabled (relaxed) | Enabled  | Restricted origins | If using cookies |
| Production  | Enabled (strict)  | Enabled  | Restricted origins | If using cookies |

## External Documentation

- [NestJS Rate Limiting](https://docs.nestjs.com/security/rate-limiting)
- [NestJS Helmet](https://docs.nestjs.com/security/helmet)
- [NestJS CORS](https://docs.nestjs.com/security/cors)
- [@nestjs/throttler](https://www.npmjs.com/package/@nestjs/throttler)
- [Helmet.js](https://helmetjs.github.io)
