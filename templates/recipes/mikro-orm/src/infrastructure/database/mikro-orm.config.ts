import { Options } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

const config: Options<PostgreSqlDriver> = {
  driver: PostgreSqlDriver,
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  dbName: process.env.DB_NAME ?? 'app',
  user: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  entities: ['./dist/infrastructure/database/entities/*.js'],
  entitiesTs: ['./src/infrastructure/database/entities/*.ts'],
  extensions: [Migrator],
  migrations: {
    path: './src/infrastructure/database/migrations',
  },
};

export default config;
