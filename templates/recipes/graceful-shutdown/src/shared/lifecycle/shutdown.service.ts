import { Injectable, OnApplicationShutdown, Logger } from '@nestjs/common';

@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownService.name);
  private readonly cleanupFns: (() => Promise<void>)[] = [];

  registerCleanup(fn: () => Promise<void>): void {
    this.cleanupFns.push(fn);
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down (signal: ${signal ?? 'none'})...`);

    for (const fn of this.cleanupFns) {
      try {
        await fn();
      } catch (error) {
        this.logger.error(
          `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log('Shutdown complete');
  }
}
