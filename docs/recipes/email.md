# Email Recipes

Email sending for NestJS. Choose between SMTP-based sending or a managed email API.

## Available Recipes

| Recipe     | Transport           | Best For                               | Recipe README                                                       |
| ---------- | ------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| Nodemailer | SMTP / SES / custom | Full control, SMTP servers, AWS SES    | [nodemailer](../../packages/templates/recipes/nodemailer/README.md) |
| SendGrid   | REST API            | Managed delivery, templates, analytics | [sendgrid](../../packages/templates/recipes/sendgrid/README.md)     |

## Comparison

| Feature        | Nodemailer               | SendGrid                   |
| -------------- | ------------------------ | -------------------------- |
| Protocol       | SMTP                     | REST API                   |
| Hosting        | Any SMTP server          | SendGrid SaaS              |
| Templates      | Inline HTML / Handlebars | SendGrid dynamic templates |
| Deliverability | Depends on SMTP server   | Managed (high)             |
| Analytics      | None                     | Opens, clicks, bounces     |
| Attachments    | Yes                      | Yes                        |
| Rate limiting  | SMTP server dependent    | Built-in                   |
| Cost           | Free (SMTP)              | Free tier (100/day) + paid |

## Quick Start: Nodemailer

```typescript
// email.module.ts
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      defaults: {
        from: '"No Reply" <noreply@example.com>',
      },
    }),
  ],
})
export class EmailModule {}
```

```typescript
// email.service.ts
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private readonly mailer: MailerService) {}

  async sendWelcome(to: string, name: string) {
    await this.mailer.sendMail({
      to,
      subject: 'Welcome',
      html: `<p>Hello ${name}, welcome aboard.</p>`,
    });
  }
}
```

## Quick Start: SendGrid

```typescript
import { Injectable } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class SendGridService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  async send(to: string, templateId: string, data: Record<string, unknown>) {
    await sgMail.send({
      to,
      from: 'noreply@example.com',
      templateId,
      dynamicTemplateData: data,
    });
  }
}
```

## External Documentation

- [Nodemailer](https://nodemailer.com)
- [@nestjs-modules/mailer](https://www.npmjs.com/package/@nestjs-modules/mailer)
- [SendGrid Node.js SDK](https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs)
- [@sendgrid/mail](https://www.npmjs.com/package/@sendgrid/mail)
