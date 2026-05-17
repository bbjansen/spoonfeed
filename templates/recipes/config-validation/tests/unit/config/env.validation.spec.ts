import { validateEnv } from '@/config/env.validation';

describe('validateEnv', () => {
  it('should return defaults when no environment variables are provided', () => {
    const result = validateEnv({});

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
  });

  it('should accept valid environment variables', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
    });

    expect(result.NODE_ENV).toBe('production');
    expect(result.PORT).toBe(8080);
  });

  it('should coerce PORT from string to number', () => {
    const result = validateEnv({ PORT: '4000' });
    expect(result.PORT).toBe(4000);
    expect(typeof result.PORT).toBe('number');
  });

  it('should throw for an invalid NODE_ENV value', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow('Environment validation failed');
  });

  it('should throw for a non-positive PORT value', () => {
    expect(() => validateEnv({ PORT: '-1' })).toThrow('Environment validation failed');
  });
});
