# CORS

Cross-Origin Resource Sharing configuration for NestJS.

## Links

- [NestJS CORS Documentation](https://docs.nestjs.com/security/cors)
- [MDN CORS Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## Dependencies

No additional dependencies required. CORS support is built into NestJS and the Fastify adapter.

| Package | Version | Purpose                                |
| ------- | ------- | -------------------------------------- |
| (none)  | -       | Built-in to `@nestjs/platform-fastify` |

## Environment Variables

| Variable       | Description                     | Example                                             |
| -------------- | ------------------------------- | --------------------------------------------------- |
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://app.example.com,https://admin.example.com` |

## Usage

Configure in `main.ts`:

```typescript
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
  exposedHeaders: ['X-Correlation-Id'],
  credentials: true,
  maxAge: 3600,
});
```

## Generated Files

| File   | Description                                 |
| ------ | ------------------------------------------- |
| (none) | Applied directly in `main.ts` configuration |
