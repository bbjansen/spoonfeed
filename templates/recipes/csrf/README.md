# CSRF Protection

Cross-Site Request Forgery protection for Fastify-based NestJS applications.

## Links

- [@fastify/csrf-protection on npm](https://www.npmjs.com/package/@fastify/csrf-protection)
- [@fastify/csrf-protection on GitHub](https://github.com/fastify/csrf-protection)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Dependencies

| Package                    | Version  | Purpose                                   |
| -------------------------- | -------- | ----------------------------------------- |
| `@fastify/csrf-protection` | `7.0.1`  | CSRF token generation and validation      |
| `@fastify/cookie`          | `11.0.2` | Cookie support (required for CSRF tokens) |

## Usage

Register in `main.ts`:

```typescript
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

await app.register(cookie);
await app.register(csrf, {
  sessionPlugin: '@fastify/cookie',
  cookieOpts: {
    signed: true,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  },
});
```

Generate and validate tokens in routes:

```typescript
// Generate token
@Get('csrf-token')
async getCsrfToken(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
  const token = await reply.generateCsrf();
  return reply.send({ token });
}
```

## Generated Files

| File   | Description                                                   |
| ------ | ------------------------------------------------------------- |
| (none) | Applied directly in `main.ts` via Fastify plugin registration |
