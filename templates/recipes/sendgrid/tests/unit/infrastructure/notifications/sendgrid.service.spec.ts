import { ConfigService } from '@nestjs/config';
import { SendGridService } from '../../../../src/infrastructure/notifications/sendgrid.service';

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202, body: {} }]),
}));

describe('SendGridService', () => {
  let service: SendGridService;
  let sgMail: { setApiKey: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    const configService = new ConfigService({
      SENDGRID_API_KEY: 'SG.test-key',
      SENDGRID_FROM_EMAIL: 'sender@example.com',
      SENDGRID_FROM_NAME: 'TestApp',
    });

    service = new SendGridService(configService);
    service.onModuleInit();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sgMail = require('@sendgrid/mail');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should set the API key on init', () => {
    expect(sgMail.setApiKey).toHaveBeenCalledWith('SG.test-key');
  });

  it('should send an email with the correct message shape', async () => {
    await service.send({
      to: 'recipient@example.com',
      subject: 'Hello',
      text: 'World',
    });

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Hello',
        text: 'World',
        from: { email: 'sender@example.com', name: 'TestApp' },
      }),
    );
  });

  it('should propagate errors from the SendGrid client', async () => {
    sgMail.send.mockRejectedValueOnce(new Error('Unauthorized'));

    await expect(service.send({ to: 'a@b.com', subject: 'fail', text: 'body' })).rejects.toThrow(
      'Unauthorized',
    );
  });
});
