import { FeatureFlagService } from '@/shared/services/feature-flag.service';
import { ConfigService } from '@nestjs/config';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = { get: jest.fn() };
    service = new FeatureFlagService(configService as unknown as ConfigService);
  });

  it('should return true when the flag value is "true"', () => {
    configService.get.mockReturnValue('true');

    expect(service.isEnabled('MY_FLAG')).toBe(true);
  });

  it('should return true when the flag value is "1"', () => {
    configService.get.mockReturnValue('1');

    expect(service.isEnabled('MY_FLAG')).toBe(true);
  });

  it('should return false when the flag is not configured', () => {
    configService.get.mockReturnValue(undefined);

    expect(service.isEnabled('UNKNOWN_FLAG')).toBe(false);
  });

  it('should return the inverse for isDisabled()', () => {
    configService.get.mockReturnValue('true');

    expect(service.isDisabled('MY_FLAG')).toBe(false);
  });
});
