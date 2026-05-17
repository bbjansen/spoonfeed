/**
 * Migration guidance messages keyed by "fromId→toId".
 *
 * When a specific pair has no entry, the generator falls back to a
 * category-level generic message. Add new entries here as recipes
 * are added to the registry.
 */
const PAIR_GUIDANCE: Record<string, string[]> = {
  'typeorm-postgres→drizzle-postgres': [
    'Migration from TypeORM to Drizzle requires manual schema conversion:',
    '',
    '1. Convert TypeORM entity classes to Drizzle table definitions.',
    '   - TypeORM @Entity / @Column decorators → Drizzle pgTable() + column helpers.',
    '   - Move files from src/<module>/entities/ → src/infrastructure/database/schema/.',
    '',
    '2. Replace repository injection with Drizzle query builder.',
    '   - TypeORM @InjectRepository(User) → inject the `db` instance from DrizzleModule.',
    '   - Rewrite queries: repo.find({ where: { id } }) → db.select().from(users).where(eq(users.id, id)).',
    '',
    '3. Regenerate migrations from scratch.',
    '   - Delete old TypeORM migrations in src/infrastructure/database/migrations/.',
    '   - Run: pnpm drizzle:generate && pnpm drizzle:migrate.',
    '',
    '4. Update .env — the connection variable changes from DB_HOST/DB_PORT/etc to DATABASE_URL.',
    '',
    'See docs/recipes/database.md for full migration guides.',
  ],

  'typeorm-mysql→drizzle-postgres': [
    'Migration from TypeORM (MySQL) to Drizzle (PostgreSQL) is a combined ORM + database engine change:',
    '',
    '1. All TypeORM entity classes must be converted to Drizzle pgTable() definitions.',
    '2. MySQL-specific column types (e.g., TINYINT for booleans) need PostgreSQL equivalents.',
    '3. Export your data from MySQL and import into PostgreSQL.',
    '4. Replace repository injection with Drizzle query builder (see typeorm→drizzle guidance).',
    '5. Regenerate all migrations: pnpm drizzle:generate && pnpm drizzle:migrate.',
    '6. Update .env — DB_HOST/DB_PORT/etc → DATABASE_URL (PostgreSQL connection string).',
    '',
    'See docs/recipes/database.md for full migration guides.',
  ],

  'typeorm-postgres→prisma': [
    'Migration from TypeORM to Prisma requires a schema-first approach:',
    '',
    '1. Introspect your existing database to generate a Prisma schema:',
    '   npx prisma db pull',
    '',
    '2. Replace @InjectRepository() with PrismaService injection.',
    '   - Rewrite queries: repo.find() → prisma.user.findMany().',
    '',
    '3. Remove old TypeORM entity files and migration directory.',
    '4. Run: npx prisma generate to create the type-safe client.',
    '',
    'See docs/recipes/database.md for full migration guides.',
  ],

  'prisma→drizzle-postgres': [
    'Migration from Prisma to Drizzle:',
    '',
    '1. Convert Prisma schema (schema.prisma) to Drizzle table definitions (pgTable).',
    '2. Replace PrismaService with Drizzle db instance injection.',
    '3. Rewrite queries: prisma.user.findMany() → db.select().from(users).',
    '4. Remove prisma/ directory and regenerate migrations with drizzle-kit.',
    '',
    'See docs/recipes/database.md for full migration guides.',
  ],

  'pino→winston': [
    'Migration from Pino to Winston:',
    '',
    '1. Replace Pino-specific configuration with Winston transports and formats.',
    '2. Update any pino.child() calls to winston.child() or createLogger().',
    '3. Winston uses different log level names by default — verify your log levels.',
    '4. If using pino-http, replace with express-winston or manual Winston middleware.',
    '',
    'See docs/recipes/logging.md for details.',
  ],

  'winston→pino': [
    'Migration from Winston to Pino:',
    '',
    '1. Replace Winston transports/formats with Pino options and pino-pretty for dev.',
    '2. Pino uses structured JSON by default — adjust log consumers if needed.',
    '3. Replace winston.child() with pino.child() for request-scoped logging.',
    '4. Install pino-http for automatic HTTP request logging.',
    '',
    'See docs/recipes/logging.md for details.',
  ],
};

/**
 * Category-level fallback guidance when no specific pair guidance exists.
 */
const CATEGORY_GUIDANCE: Record<string, string[]> = {
  Database: [
    'You are migrating between database recipes. Manual steps required:',
    '',
    '1. Convert entity/model definitions to the new ORM format.',
    '2. Rewrite repository/query code to use the new ORM API.',
    '3. Regenerate or recreate database migrations.',
    '4. Update environment variables if the connection format changed.',
    '5. Verify all database tests pass with the new ORM.',
    '',
    'Check docs/recipes/database.md for ORM-specific migration guides.',
  ],

  Logging: [
    'You are migrating between logging recipes. Manual steps required:',
    '',
    '1. Update logger configuration to the new library format.',
    '2. Replace any library-specific logger API calls.',
    '3. Verify log output format matches your log aggregation pipeline.',
    '',
    'Check docs/recipes/logging.md for details.',
  ],

  Authentication: [
    'You are migrating between authentication recipes. Manual steps required:',
    '',
    '1. Update auth guards and strategy configuration.',
    '2. Migrate user session/token handling to the new auth approach.',
    '3. Update any middleware or interceptors that depend on auth state.',
    '4. Re-test all protected endpoints.',
    '',
    'Check docs/recipes/authentication.md for details.',
  ],

  'Cloud Storage': [
    'You are migrating between cloud storage recipes. Manual steps required:',
    '',
    '1. Update SDK imports and client configuration.',
    '2. Rewrite upload/download/delete operations to the new SDK API.',
    '3. Update IAM/credential configuration for the new provider.',
    '4. Migrate existing stored objects if changing providers.',
    '',
    'Check docs/recipes/cloud-storage.md for details.',
  ],

  'Message Queue': [
    'You are migrating between message queue recipes. Manual steps required:',
    '',
    '1. Update consumer/producer code to the new transport API.',
    '2. Recreate queue/topic/exchange definitions for the new broker.',
    '3. Update environment variables for the new connection.',
    '4. Verify message serialization/deserialization works correctly.',
    '',
    'Check docs/recipes/messaging.md for details.',
  ],
};

const GENERIC_GUIDANCE: string[] = [
  'Migration complete. The old recipe has been removed and the new recipe has been added.',
  '',
  'Manual steps may be required:',
  '1. Review the diff to understand what files changed.',
  '2. Update any code that imported from the old recipe modules.',
  '3. Run the full test suite to catch breaking changes.',
  '4. Update environment variables if needed.',
];

export function getMigrationGuidance(fromId: string, toId: string, category: string): string[] {
  const pairKey = `${fromId}\u2192${toId}`;
  if (PAIR_GUIDANCE[pairKey]) {
    return PAIR_GUIDANCE[pairKey];
  }

  if (CATEGORY_GUIDANCE[category]) {
    return CATEGORY_GUIDANCE[category];
  }

  return GENERIC_GUIDANCE;
}
