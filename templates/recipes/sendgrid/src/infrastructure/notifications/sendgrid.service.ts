import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
}

@Injectable()
export class SendGridService implements OnModuleInit {
  private readonly logger = new Logger(SendGridService.name);
  private fromEmail: string;
  private fromName: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.getOrThrow<string>('SENDGRID_API_KEY');
    this.fromEmail = this.config.getOrThrow<string>('SENDGRID_FROM_EMAIL');
    this.fromName = this.config.get<string>('SENDGRID_FROM_NAME', 'App');

    sgMail.setApiKey(apiKey);
  }

  async send(options: SendEmailOptions): Promise<void> {
    const message: sgMail.MailDataRequired = {
      to: options.to,
      from: { email: this.fromEmail, name: this.fromName },
      subject: options.subject,
      ...(options.text && { text: options.text }),
      ...(options.html && { html: options.html }),
      ...(options.templateId && { templateId: options.templateId }),
      ...(options.dynamicTemplateData && {
        dynamicTemplateData: options.dynamicTemplateData,
      }),
    };

    try {
      await sgMail.send(message);
      this.logger.log(
        `Email sent to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async sendMultiple(messages: SendEmailOptions[]): Promise<void> {
    await Promise.all(messages.map((msg) => this.send(msg)));
  }
}
