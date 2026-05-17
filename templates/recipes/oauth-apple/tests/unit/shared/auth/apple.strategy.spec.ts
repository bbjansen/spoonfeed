import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppleStrategy } from '@/shared/auth/apple.strategy';

describe('AppleStrategy', () => {
  let strategy: AppleStrategy;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        APPLE_CLIENT_ID: 'com.example.app',
        APPLE_TEAM_ID: 'TEAM123',
        APPLE_KEY_ID: 'KEY456',
        APPLE_PRIVATE_KEY_PATH: '/path/to/key.p8',
        APPLE_CALLBACK_URL: 'http://localhost:3000/auth/apple/callback',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AppleStrategy, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    strategy = module.get(AppleStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should extract user from Apple decoded ID token', () => {
    const decodedIdToken = {
      sub: 'apple-user-001',
      email: 'user@privaterelay.appleid.com',
    };
    const done = jest.fn();

    strategy.validate('access-token', 'refresh-token', decodedIdToken, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'apple',
      providerId: 'apple-user-001',
      email: 'user@privaterelay.appleid.com',
      accessToken: 'access-token',
    });
  });

  it('should handle decoded ID token without email', () => {
    const decodedIdToken = {
      sub: 'apple-user-002',
    };
    const done = jest.fn();

    strategy.validate('access-token', 'refresh-token', decodedIdToken as any, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'apple',
      providerId: 'apple-user-002',
      email: undefined,
      accessToken: 'access-token',
    });
  });
});
