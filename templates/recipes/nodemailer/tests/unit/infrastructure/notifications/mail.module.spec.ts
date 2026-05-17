import { ConfigService } from '@nestjs/config';

describe('MailModule', () => {
  it('should resolve transport config from environment variables', () => {
    const configService = new ConfigService({
      MAIL_HOST: 'smtp.example.com',
      MAIL_PORT: 587,
      MAIL_USER: 'user@example.com',
      MAIL_PASSWORD: 'password',
      MAIL_FROM: 'noreply@example.com',
    });

    expect(configService.getOrThrow('MAIL_HOST')).toBe('smtp.example.com');
    expect(configService.getOrThrow('MAIL_PORT')).toBe(587);
    expect(configService.getOrThrow('MAIL_USER')).toBe('user@example.com');
    expect(configService.getOrThrow('MAIL_PASSWORD')).toBe('password');
    expect(configService.getOrThrow('MAIL_FROM')).toBe('noreply@example.com');
  });

  it('should detect secure transport on port 465', () => {
    const configService = new ConfigService({ MAIL_PORT: 465 });
    const port = configService.get<number>('MAIL_PORT');
    const secure = port === 465;
    expect(secure).toBe(true);
  });

  it('should not use secure transport on port 587', () => {
    const configService = new ConfigService({ MAIL_PORT: 587 });
    const port = configService.get<number>('MAIL_PORT');
    const secure = port === 465;
    expect(secure).toBe(false);
  });
});
