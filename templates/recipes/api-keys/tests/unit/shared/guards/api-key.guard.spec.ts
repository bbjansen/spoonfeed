import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from '../../../../src/shared/guards/api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let configService: ConfigService;

  const createMockContext = (apiKey?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: apiKey !== undefined ? { 'x-api-key': apiKey } : {},
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('valid-key') } as unknown as ConfigService;
    guard = new ApiKeyGuard(configService);
  });

  it('should throw UnauthorizedException when x-api-key header is missing', () => {
    const context = createMockContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when api key does not match', () => {
    const context = createMockContext('wrong-key');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should return true when api key is valid', () => {
    const context = createMockContext('valid-key');

    expect(guard.canActivate(context)).toBe(true);
  });
});
