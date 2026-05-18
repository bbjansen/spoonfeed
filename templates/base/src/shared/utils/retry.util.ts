import { Logger } from '@nestjs/common';

const logger = new Logger('Retry');

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxAttempts, delayMs, backoffMultiplier = 2 } = options;

  let lastError: Error | undefined;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay *= backoffMultiplier;
      }
    }
  }

  throw lastError as Error;
}
