import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types';

export const KYSELY = Symbol('KYSELY');

@Global()
@Module({
  providers: [
    {
      provide: KYSELY,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Kysely<Database> => {
        return new Kysely<Database>({
          dialect: new PostgresDialect({
            pool: new Pool({
              connectionString: configService.getOrThrow<string>('DATABASE_URL'),
            }),
          }),
        });
      },
    },
  ],
  exports: [KYSELY],
})
export class DatabaseModule {}
