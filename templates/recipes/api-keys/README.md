# API Key Authentication

Custom API key authentication using the `x-api-key` header for NestJS applications.

## Links

- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [NestJS Security Documentation](https://docs.nestjs.com/security/authentication)

## Dependencies

| Package          | Version   | Purpose                                                      |
| ---------------- | --------- | ------------------------------------------------------------ |
| `@nestjs/common` | `10.4.15` | Core NestJS decorators and guards (included in base)         |
| `@nestjs/config` | `3.3.0`   | Configuration module for reading API keys (included in base) |

## Environment Variables

| Variable  | Default | Description                                                |
| --------- | ------- | ---------------------------------------------------------- |
| `API_KEY` | —       | The API key clients must provide in the `x-api-key` header |

## Usage

```typescript
// Protect a route with API key authentication
@Controller('webhooks')
export class WebhookController {
  @UseGuards(ApiKeyGuard)
  @Post('stripe')
  handleStripeWebhook(@Body() payload: any) {
    return { received: true };
  }
}

// Or apply globally in main.ts
app.useGlobalGuards(app.get(ApiKeyGuard));
```

## Generated Files

| File                                 | Description                                                            |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `src/shared/guards/api-key.guard.ts` | Guard that validates the `x-api-key` header against configured API key |
