import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { GitHubStrategy } from '@/shared/auth/github.strategy';

describe('GitHubStrategy', () => {
  let strategy: GitHubStrategy;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GITHUB_CLIENT_ID: 'test-client-id',
        GITHUB_CLIENT_SECRET: 'test-client-secret',
        GITHUB_CALLBACK_URL: 'http://localhost:3000/auth/github/callback',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GitHubStrategy, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    strategy = module.get(GitHubStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should extract user profile from GitHub OAuth callback', () => {
    const profile = {
      id: 'gh-789',
      displayName: 'GitHub User',
      emails: [{ value: 'ghuser@example.com' }],
      photos: [{ value: 'https://avatars.githubusercontent.com/u/123' }],
    };
    const done = jest.fn();

    strategy.validate('access-token', 'refresh-token', profile as any, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'github',
      providerId: 'gh-789',
      email: 'ghuser@example.com',
      name: 'GitHub User',
      avatar: 'https://avatars.githubusercontent.com/u/123',
      accessToken: 'access-token',
    });
  });

  it('should handle profile with missing optional fields', () => {
    const profile = {
      id: 'gh-000',
      displayName: 'Private User',
      emails: undefined,
      photos: undefined,
    };
    const done = jest.fn();

    strategy.validate('access-token', 'refresh-token', profile as any, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'github',
      providerId: 'gh-000',
      email: undefined,
      name: 'Private User',
      avatar: undefined,
      accessToken: 'access-token',
    });
  });
});
