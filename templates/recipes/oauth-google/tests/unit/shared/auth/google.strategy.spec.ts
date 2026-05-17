import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { GoogleStrategy } from '@/shared/auth/google.strategy';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GoogleStrategy, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    strategy = module.get(GoogleStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should extract user profile from Google OAuth callback', () => {
    const profile = {
      id: 'google-123',
      displayName: 'Test User',
      emails: [{ value: 'test@example.com', verified: true }],
      photos: [{ value: 'https://lh3.googleusercontent.com/photo.jpg' }],
    };
    const done = jest.fn();

    strategy.validate('access-token', 'refresh-token', profile as any, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerId: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: 'https://lh3.googleusercontent.com/photo.jpg',
      accessToken: 'access-token',
    });
  });

  it('should handle profile with missing optional fields', () => {
    const profile = {
      id: 'google-456',
      displayName: 'No Email User',
      emails: undefined,
      photos: undefined,
    };
    const done = jest.fn();

    strategy.validate('access-token', 'refresh-token', profile as any, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerId: 'google-456',
      email: undefined,
      name: 'No Email User',
      avatar: undefined,
      accessToken: 'access-token',
    });
  });
});
