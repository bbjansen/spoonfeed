# SendGrid

Transactional email delivery via the SendGrid API.

## Links

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid Node.js Quickstart](https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs)
- [@sendgrid/mail on npm](https://www.npmjs.com/package/@sendgrid/mail)
- [@sendgrid/mail on GitHub](https://github.com/sendgrid/sendgrid-nodejs)

## Dependencies

| Package          | Version | Purpose                  |
| ---------------- | ------- | ------------------------ |
| `@sendgrid/mail` | `8.1.4` | SendGrid Mail API client |

## Environment Variables

| Variable              | Description             | Example               |
| --------------------- | ----------------------- | --------------------- |
| `SENDGRID_API_KEY`    | SendGrid API key        | `SG.xxxxxx`           |
| `SENDGRID_FROM_EMAIL` | Verified sender address | `noreply@example.com` |
| `SENDGRID_FROM_NAME`  | Sender display name     | `My App`              |

## Usage

```typescript
import { SendGridService } from '@/infrastructure/notifications/sendgrid.service';

constructor(private readonly sendgrid: SendGridService) {}

await this.sendgrid.send({
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'Hello!',
  html: '<h1>Hello!</h1>',
});
```

## Generated Files

| File                                                   | Description            |
| ------------------------------------------------------ | ---------------------- |
| `src/infrastructure/notifications/sendgrid.service.ts` | SendGrid email service |
