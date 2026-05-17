# Nodemailer

Email sending via @nestjs-modules/mailer with Nodemailer transport.

## Links

- [NestJS Mailer Module](https://nest-modules.github.io/mailer/)
- [Nodemailer Documentation](https://nodemailer.com)
- [@nestjs-modules/mailer on npm](https://www.npmjs.com/package/@nestjs-modules/mailer)
- [@nestjs-modules/mailer on GitHub](https://github.com/nest-modules/mailer)

## Dependencies

| Package                  | Version  | Purpose               |
| ------------------------ | -------- | --------------------- |
| `@nestjs-modules/mailer` | `2.0.2`  | NestJS mailer module  |
| `nodemailer`             | `6.9.16` | SMTP transport        |
| `handlebars`             | `4.7.8`  | Email template engine |

## Environment Variables

| Variable        | Description            | Example               |
| --------------- | ---------------------- | --------------------- |
| `MAIL_HOST`     | SMTP server hostname   | `smtp.example.com`    |
| `MAIL_PORT`     | SMTP port              | `587`                 |
| `MAIL_USER`     | SMTP username          | `noreply@example.com` |
| `MAIL_PASSWORD` | SMTP password          | `secret`              |
| `MAIL_FROM`     | Default "from" address | `noreply@example.com` |

## Usage

```typescript
import { MailModule } from '@/infrastructure/notifications/mail.module';

@Module({
  imports: [MailModule],
})
export class AppModule {}

// In a service
constructor(private readonly mailer: MailerService) {}

await this.mailer.sendMail({
  to: 'user@example.com',
  subject: 'Welcome',
  template: 'welcome',
  context: { name: 'Alice' },
});
```

## Generated Files

| File                                              | Description                                     |
| ------------------------------------------------- | ----------------------------------------------- |
| `src/infrastructure/notifications/mail.module.ts` | Mailer module with SMTP transport configuration |
