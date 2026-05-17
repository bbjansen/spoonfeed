import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

/**
 * Prisma service for database access.
 *
 * After installing dependencies, run:
 *   pnpm prisma generate
 *
 * Then update this file to import from @prisma/client:
 *   import { PrismaClient } from '@prisma/client';
 *   export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy { ... }
 *
 * Until prisma generate is run, this service provides a placeholder
 * that will be replaced by the generated client.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // After running `prisma generate`, uncomment:
    // await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    // After running `prisma generate`, uncomment:
    // await this.$disconnect();
  }
}
