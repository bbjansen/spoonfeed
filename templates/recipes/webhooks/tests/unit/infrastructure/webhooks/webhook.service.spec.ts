import { WebhookService } from '@/infrastructure/webhooks/webhook.service';
import { ConfigService } from '@nestjs/config';

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    service = new WebhookService(configService);
  });

  it('should produce a consistent HMAC-SHA256 signature for the same payload', () => {
    const payload = JSON.stringify({ event: 'test', data: {}, timestamp: '2026-01-01T00:00:00Z' });

    const sig1 = (service as any).sign(payload);
    const sig2 = (service as any).sign(payload);

    expect(typeof sig1).toBe('string');
    expect(sig1).toHaveLength(64); // SHA-256 hex digest
    expect(sig1).toBe(sig2);
  });

  it('should produce different signatures for different payloads', () => {
    const sig1 = (service as any).sign('{"event":"a"}');
    const sig2 = (service as any).sign('{"event":"b"}');

    expect(sig1).not.toBe(sig2);
  });
});
