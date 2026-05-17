import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DPoPGuard } from '@/shared/guards/dpop.guard';

describe('DPoPGuard', () => {
  let guard: DPoPGuard;

  const mockConfigService = {
    getOrThrow: jest.fn(),
  };

  function createMockContext(headers: Record<string, string | undefined>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          method: 'GET',
          protocol: 'https',
          hostname: 'api.example.com',
          url: '/resource?page=1',
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DPoPGuard, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    guard = module.get(DPoPGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw UnauthorizedException when DPoP header is missing', async () => {
    const context = createMockContext({
      authorization: 'DPoP some-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Missing DPoP proof header');
  });

  it('should throw UnauthorizedException when Authorization header does not use DPoP scheme', async () => {
    const context = createMockContext({
      dpop: 'some-proof-jwt',
      authorization: 'Bearer some-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Authorization header must use DPoP scheme',
    );
  });

  it('should throw UnauthorizedException for an invalid DPoP proof JWT', async () => {
    const context = createMockContext({
      dpop: 'invalid.jwt.token',
      authorization: 'DPoP some-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid DPoP proof');
  });
});
