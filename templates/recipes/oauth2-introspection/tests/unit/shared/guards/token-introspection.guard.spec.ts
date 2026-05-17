import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TokenIntrospectionGuard } from '@/shared/guards/token-introspection.guard';

describe('TokenIntrospectionGuard', () => {
  let guard: TokenIntrospectionGuard;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        OAUTH2_INTROSPECTION_URL: 'https://auth.example.com/introspect',
        OAUTH2_CLIENT_ID: 'client-id',
        OAUTH2_CLIENT_SECRET: 'client-secret',
      };
      return config[key];
    }),
  };

  function createMockContext(authHeader?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: authHeader },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TokenIntrospectionGuard, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    guard = module.get(TokenIntrospectionGuard);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    const context = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when Authorization header does not use Bearer scheme', async () => {
    const context = createMockContext('Basic dXNlcjpwYXNz');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token is not active', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: false }),
    } as Response);

    const context = createMockContext('Bearer expired-token');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should set request.user and return true for an active token', async () => {
    const introspectionResponse = {
      active: true,
      sub: 'user-123',
      username: 'testuser',
      scope: 'read write',
      client_id: 'client-id',
    };

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => introspectionResponse,
    } as Response);

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      sub: 'user-123',
      username: 'testuser',
      scope: 'read write',
      clientId: 'client-id',
    });
  });
});
