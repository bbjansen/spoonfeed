# Helmet

HTTP security headers via @fastify/helmet for Fastify-based NestJS applications.

## Links

- [NestJS Helmet Documentation](https://docs.nestjs.com/security/helmet)
- [@fastify/helmet on npm](https://www.npmjs.com/package/@fastify/helmet)
- [@fastify/helmet on GitHub](https://github.com/fastify/fastify-helmet)

## Dependencies

| Package           | Version  | Purpose                                 |
| ----------------- | -------- | --------------------------------------- |
| `@fastify/helmet` | `13.0.2` | Security headers middleware for Fastify |

## Usage

Register in `main.ts`:

```typescript
import helmet from '@fastify/helmet';

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
});
```

## Generated Files

| File   | Description                                                   |
| ------ | ------------------------------------------------------------- |
| (none) | Applied directly in `main.ts` via Fastify plugin registration |
