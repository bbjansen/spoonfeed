import type { MigrationInterface } from 'typeorm';

// Import migration classes here as they are generated.
// esbuild cannot resolve glob patterns at runtime in Lambda,
// so all migrations must be explicitly imported.
//
// Workflow:
//   1. pnpm migration:generate src/infrastructure/database/migrations/MigrationName
//   2. Import the generated class here and add it to the array
export const migrations: (new () => MigrationInterface)[] = [];
