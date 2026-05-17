import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate limiting configuration with multiple tiers.
 *
 * - short: 10 requests per second (burst protection)
 * - medium: 100 requests per 10 seconds
 * - long: 1000 requests per minute
 */
export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'short',
      ttl: 1000,
      limit: 10,
    },
    {
      name: 'medium',
      ttl: 10_000,
      limit: 100,
    },
    {
      name: 'long',
      ttl: 60_000,
      limit: 1000,
    },
  ],
};
