import type { RecipeRegistry } from './registry.js';
import type { RecipeDefinition } from '../types.js';

export const recipeDefinitions: RecipeDefinition[] = [
  // ─── Database ───────────────────────────────────────────────────────
  {
    id: 'typeorm-postgres',
    name: 'TypeORM + PostgreSQL',
    description: 'TypeORM integration with PostgreSQL driver',
    category: 'Database',
    dependencies: {
      '@nestjs/typeorm': '10.0.2',
      typeorm: '0.3.20',
      pg: '8.13.1',
    },
    devDependencies: {},
    envVars: [
      { key: 'DB_HOST', defaultValue: 'localhost', description: 'PostgreSQL host' },
      { key: 'DB_PORT', defaultValue: '5432', description: 'PostgreSQL port' },
      { key: 'DB_USERNAME', defaultValue: 'postgres', description: 'PostgreSQL username' },
      { key: 'DB_PASSWORD', defaultValue: 'postgres', description: 'PostgreSQL password' },
      { key: 'DB_NAME', defaultValue: 'app', description: 'PostgreSQL database name' },
    ],
    conflicts: ['typeorm-mysql', 'prisma', 'mongoose', 'drizzle-postgres', 'kysely', 'mikro-orm'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'typeorm-postgres',
    claudeMdSection: [
      '## TypeORM + PostgreSQL',
      'Entities live in `src/<module>/entities/`. Use migrations for schema changes — never `synchronize: true` in production.',
      'Run migrations: `pnpm typeorm migration:run`. Generate: `pnpm typeorm migration:generate`.',
    ].join('\n'),
    cursorRules: [
      'Use TypeORM repository pattern via @InjectRepository(). Always create and run migrations for schema changes.',
      'Place entities in the module they belong to under entities/. Use column decorators for all fields.',
    ].join('\n'),
    copilotInstructions: [
      'TypeORM with PostgreSQL is used for database access. Inject repositories with @InjectRepository().',
      'Never use synchronize:true in production. Generate migrations with typeorm CLI.',
    ].join('\n'),
  },
  {
    id: 'typeorm-mysql',
    name: 'TypeORM + MySQL',
    description: 'TypeORM integration with MySQL driver',
    category: 'Database',
    dependencies: {
      '@nestjs/typeorm': '10.0.2',
      typeorm: '0.3.20',
      mysql2: '3.11.5',
    },
    devDependencies: {},
    envVars: [
      { key: 'DB_HOST', defaultValue: 'localhost', description: 'MySQL host' },
      { key: 'DB_PORT', defaultValue: '3306', description: 'MySQL port' },
      { key: 'DB_USERNAME', defaultValue: 'root', description: 'MySQL username' },
      { key: 'DB_PASSWORD', defaultValue: 'root', description: 'MySQL password' },
      { key: 'DB_NAME', defaultValue: 'app', description: 'MySQL database name' },
    ],
    conflicts: ['typeorm-postgres', 'prisma', 'mongoose', 'drizzle-postgres', 'kysely', 'mikro-orm'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'typeorm-mysql',
    claudeMdSection: [
      '## TypeORM + MySQL',
      'Entities live in `src/<module>/entities/`. Use migrations for schema changes — never `synchronize: true` in production.',
      'Run migrations: `pnpm typeorm migration:run`. Generate: `pnpm typeorm migration:generate`.',
    ].join('\n'),
    cursorRules: [
      'Use TypeORM repository pattern via @InjectRepository(). Always create and run migrations for schema changes.',
      'Place entities in the module they belong to under entities/. Use column decorators for all fields.',
    ].join('\n'),
    copilotInstructions: [
      'TypeORM with MySQL is used for database access. Inject repositories with @InjectRepository().',
      'Never use synchronize:true in production. Generate migrations with typeorm CLI.',
    ].join('\n'),
  },
  {
    id: 'prisma',
    name: 'Prisma',
    description: 'Prisma ORM with schema-first approach and type-safe client',
    category: 'Database',
    dependencies: {
      '@prisma/client': '6.2.1',
    },
    devDependencies: {
      prisma: '6.2.1',
    },
    envVars: [
      {
        key: 'DATABASE_URL',
        defaultValue: 'postgresql://postgres:postgres@localhost:5432/app',
        description: 'Prisma database connection URL',
      },
    ],
    conflicts: ['typeorm-postgres', 'typeorm-mysql', 'mongoose', 'drizzle-postgres', 'kysely', 'mikro-orm', 'soft-delete', 'transactional-outbox'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'prisma',
    claudeMdSection: [
      '## Prisma',
      'Schema lives in `prisma/schema.prisma`. Run `pnpm prisma generate` after schema changes.',
      'Migrations: `pnpm prisma migrate dev`. Inject `PrismaService` for database access.',
    ].join('\n'),
    cursorRules: [
      'Use PrismaService (extends PrismaClient) for all database access. Edit prisma/schema.prisma for model changes.',
      'Always run `prisma generate` after schema edits. Use Prisma migrate for schema migrations.',
    ].join('\n'),
    copilotInstructions: [
      'Prisma ORM is used. Models are defined in prisma/schema.prisma. Inject PrismaService for queries.',
      'After modifying the schema, run `pnpm prisma generate` then `pnpm prisma migrate dev`.',
    ].join('\n'),
  },
  {
    id: 'mongoose',
    name: 'Mongoose',
    description: 'MongoDB integration with Mongoose ODM',
    category: 'Database',
    dependencies: {
      '@nestjs/mongoose': '10.1.0',
      mongoose: '8.9.5',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'MONGO_URI',
        defaultValue: 'mongodb://localhost:27017/app',
        description: 'MongoDB connection URI',
      },
    ],
    conflicts: ['typeorm-postgres', 'typeorm-mysql', 'prisma', 'drizzle-postgres', 'kysely', 'mikro-orm', 'soft-delete', 'transactional-outbox'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'mongoose',
    claudeMdSection: [
      '## Mongoose',
      'Schemas live in `src/<module>/schemas/`. Use @Schema() and @Prop() decorators.',
      'Inject models with @InjectModel(). Use lean() for read-only queries.',
    ].join('\n'),
    cursorRules: [
      'Use @Schema() decorator classes for Mongoose schemas. Inject models via @InjectModel(SchemaName.name).',
      'Place schemas alongside their module. Prefer lean() queries when documents are read-only.',
    ].join('\n'),
    copilotInstructions: [
      'Mongoose ODM is used with NestJS decorators. Define schemas with @Schema()/@Prop() in schemas/ folders.',
      'Inject models via @InjectModel(). Use lean() for read-only queries for better performance.',
    ].join('\n'),
  },

  {
    id: 'drizzle-postgres',
    name: 'Drizzle ORM + PostgreSQL',
    description: 'Lightweight type-safe ORM with best-in-class performance',
    category: 'Database',
    dependencies: {
      'drizzle-orm': '0.44.2',
      pg: '8.13.1',
    },
    devDependencies: {
      'drizzle-kit': '0.31.1',
    },
    envVars: [
      {
        key: 'DATABASE_URL',
        defaultValue: 'postgres://postgres:postgres@localhost:5432/app',
        description: 'PostgreSQL connection URL',
      },
    ],
    conflicts: ['typeorm-postgres', 'typeorm-mysql', 'prisma', 'mongoose', 'kysely', 'mikro-orm', 'soft-delete', 'transactional-outbox'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'drizzle-postgres',
    claudeMdSection: [
      '## Drizzle ORM',
      'Schema in `src/infrastructure/database/schema/`. Run `pnpm drizzle:generate` after schema changes, then `pnpm drizzle:migrate`.',
    ].join('\n'),
    cursorRules:
      'Use Drizzle schema definitions in src/infrastructure/database/schema/. Use drizzle-kit for migrations. Queries use the db object from drizzle().',
    copilotInstructions:
      'Drizzle ORM for database. Schema files in src/infrastructure/database/schema/. Use drizzle-kit generate and migrate for schema changes.',
  },

  {
    id: 'kysely',
    name: 'Kysely',
    description: 'Type-safe SQL query builder with zero overhead',
    category: 'Database',
    dependencies: {
      kysely: '0.27.6',
      pg: '8.13.1',
    },
    devDependencies: {
      'kysely-ctl': '0.9.0',
    },
    envVars: [
      {
        key: 'DATABASE_URL',
        defaultValue: 'postgres://postgres:postgres@localhost:5432/app',
        description: 'PostgreSQL connection URL',
      },
    ],
    conflicts: [
      'typeorm-postgres',
      'typeorm-mysql',
      'prisma',
      'mongoose',
      'drizzle-postgres',
      'mikro-orm',
      'soft-delete',
      'transactional-outbox',
    ],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'kysely',
    claudeMdSection:
      '## Kysely\nType-safe SQL query builder. Define database types in `src/infrastructure/database/types.ts`. Use the db instance for queries. Migrations via kysely-ctl.',
    cursorRules:
      'Use Kysely for type-safe SQL. Define table interfaces in types.ts. Use db.selectFrom(), db.insertInto(), etc. No ORM magic — you write the SQL.',
    copilotInstructions:
      'Kysely is a type-safe SQL query builder. Database types in src/infrastructure/database/types.ts. Use selectFrom/insertInto/updateTable/deleteFrom methods.',
  },
  {
    id: 'mikro-orm',
    name: 'MikroORM + PostgreSQL',
    description: 'Data Mapper ORM with Unit of Work and Identity Map for DDD',
    category: 'Database',
    dependencies: {
      '@mikro-orm/core': '6.5.3',
      '@mikro-orm/nestjs': '6.1.1',
      '@mikro-orm/postgresql': '6.5.3',
      '@mikro-orm/migrations': '6.5.3',
    },
    devDependencies: {
      '@mikro-orm/cli': '6.5.3',
    },
    envVars: [
      { key: 'DB_HOST', defaultValue: 'localhost', description: 'PostgreSQL host' },
      { key: 'DB_PORT', defaultValue: '5432', description: 'PostgreSQL port' },
      { key: 'DB_NAME', defaultValue: 'app', description: 'PostgreSQL database name' },
      { key: 'DB_USERNAME', defaultValue: 'postgres', description: 'PostgreSQL username' },
      { key: 'DB_PASSWORD', defaultValue: 'postgres', description: 'PostgreSQL password' },
    ],
    conflicts: ['typeorm-postgres', 'typeorm-mysql', 'prisma', 'mongoose', 'drizzle-postgres', 'kysely', 'soft-delete', 'transactional-outbox'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'mikro-orm',
    claudeMdSection:
      '## MikroORM\nEntities in `src/infrastructure/database/entities/`. Uses Unit of Work pattern — changes are flushed via `em.flush()`. Run `pnpm mikro-orm migration:create` for migrations.',
    cursorRules:
      'Use MikroORM entity manager (em) for queries. Entities use @Entity() decorator. Changes persist on em.flush(). Use @mikro-orm/cli for migrations.',
    copilotInstructions:
      'MikroORM with Unit of Work pattern. Use EntityManager for queries. Call em.flush() to persist. Migrations via @mikro-orm/cli.',
  },

  // ─── Cache ──────────────────────────────────────────────────────────
  {
    id: 'redis-cache',
    name: 'Redis Cache',
    description: 'Redis-backed caching with cache-manager',
    category: 'Cache',
    dependencies: {
      '@nestjs/cache-manager': '2.3.0',
      'cache-manager-redis-yet': '5.1.5',
      ioredis: '5.4.2',
    },
    devDependencies: {},
    envVars: [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
      { key: 'REDIS_PORT', defaultValue: '6379', description: 'Redis port' },
      { key: 'REDIS_PASSWORD', defaultValue: '', description: 'Redis password (empty for local)' },
      { key: 'REDIS_TTL', defaultValue: '300', description: 'Default cache TTL in seconds' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: [
      'http-api',
      'aws-lambda',
      'microservice',
      'scheduled-worker',
      'monorepo',
      'full-stack',
    ],
    templateDir: 'redis-cache',
    claudeMdSection: [
      '## Redis Cache',
      'Use @UseInterceptors(CacheInterceptor) for automatic route caching or inject CACHE_MANAGER directly.',
      'Default TTL is configured in the CacheModule registration.',
    ].join('\n'),
    cursorRules: [
      'Use @CacheKey() and @CacheTTL() decorators on controller methods. Inject CACHE_MANAGER for manual cache operations.',
      'Invalidate cache explicitly when underlying data changes.',
    ].join('\n'),
    copilotInstructions: [
      'Redis caching is configured via @nestjs/cache-manager. Use CacheInterceptor for automatic caching.',
      'For manual control, inject CACHE_MANAGER token. Always invalidate stale cache on writes.',
    ].join('\n'),
  },

  // ─── Queue ──────────────────────────────────────────────────────────
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    description: 'RabbitMQ message broker integration',
    category: 'Queue',
    dependencies: {
      '@nestjs/microservices': '11.1.19',
      amqplib: '0.10.5',
    },
    devDependencies: {
      '@types/amqplib': '0.10.6',
    },
    envVars: [
      {
        key: 'RABBITMQ_URL',
        defaultValue: 'amqp://guest:guest@localhost:5672',
        description: 'RabbitMQ connection URL',
      },
    ],
    conflicts: ['bullmq'],
    requires: [],
    compatibleWith: [
      'http-api',
      'aws-lambda',
      'microservice',
      'scheduled-worker',
      'monorepo',
      'full-stack',
    ],
    templateDir: 'rabbitmq',
    claudeMdSection: [
      '## RabbitMQ',
      'Use @MessagePattern() for request/response and @EventPattern() for fire-and-forget.',
      'Configure queues in the microservice module registration. Use durable queues in production.',
    ].join('\n'),
    cursorRules: [
      'Use @MessagePattern() for RPC and @EventPattern() for events. Always acknowledge messages.',
      'Define message contracts as typed interfaces. Handle deserialization errors gracefully.',
    ].join('\n'),
    copilotInstructions: [
      'RabbitMQ is integrated via @nestjs/microservices. Use @MessagePattern/@EventPattern decorators.',
      'Always define typed DTOs for message payloads. Use durable queues and handle dead-letter routing.',
    ].join('\n'),
  },
  {
    id: 'bullmq',
    name: 'BullMQ',
    description: 'Redis-backed job queue with BullMQ',
    category: 'Queue',
    dependencies: {
      '@nestjs/bullmq': '10.2.3',
      bullmq: '5.34.8',
    },
    devDependencies: {},
    envVars: [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host for BullMQ' },
      { key: 'REDIS_PORT', defaultValue: '6379', description: 'Redis port for BullMQ' },
    ],
    conflicts: ['rabbitmq'],
    requires: [],
    compatibleWith: [
      'http-api',
      'aws-lambda',
      'microservice',
      'scheduled-worker',
      'monorepo',
      'full-stack',
    ],
    templateDir: 'bullmq',
    claudeMdSection: [
      '## BullMQ',
      'Define processors with @Processor() and handle jobs with @WorkerHost. Add jobs via inject Queue.',
      'Configure concurrency and rate limiting per queue. Use named jobs for routing.',
    ].join('\n'),
    cursorRules: [
      'Create processors extending WorkerHost with @Processor(). Inject Queue to add jobs.',
      'Use named jobs and handle failed jobs with @OnWorkerEvent(). Set appropriate concurrency.',
    ].join('\n'),
    copilotInstructions: [
      'BullMQ is used for background jobs. Extend WorkerHost with @Processor() for consumers.',
      'Inject Queue to enqueue jobs. Handle retries and failures with @OnWorkerEvent decorators.',
    ].join('\n'),
  },

  // ─── Auth ───────────────────────────────────────────────────────────
  {
    id: 'jwt-auth',
    name: 'JWT Authentication',
    description: 'JWT-based authentication with Passport',
    category: 'Auth',
    dependencies: {
      '@nestjs/jwt': '10.2.0',
      '@nestjs/passport': '10.0.3',
      'passport-jwt': '4.0.1',
    },
    devDependencies: {
      '@types/passport-jwt': '4.0.1',
    },
    envVars: [
      {
        key: 'JWT_SECRET',
        defaultValue: 'change-me-in-production',
        description: 'JWT signing secret',
      },
      { key: 'JWT_EXPIRES_IN', defaultValue: '3600s', description: 'JWT token expiration' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'microservice', 'full-stack', 'monorepo'],
    templateDir: 'jwt-auth',
    claudeMdSection: [
      '## JWT Authentication',
      'Use @UseGuards(JwtAuthGuard) on protected routes. The JWT strategy extracts and validates tokens.',
      'Access the authenticated user with @CurrentUser() parameter decorator.',
    ].join('\n'),
    cursorRules: [
      'Apply JwtAuthGuard to protected endpoints. Use @CurrentUser() to access the authenticated user.',
      'Never hardcode JWT_SECRET — always use ConfigService. Set short expiration and use refresh tokens.',
    ].join('\n'),
    copilotInstructions: [
      'JWT auth is configured with @nestjs/jwt and passport-jwt. Protect routes with @UseGuards(JwtAuthGuard).',
      'Use @CurrentUser() decorator to get the authenticated user. JWT_SECRET comes from environment.',
    ].join('\n'),
  },
  {
    id: 'passport',
    name: 'Passport Strategies',
    description: 'Passport.js with local and JWT strategies',
    category: 'Auth',
    dependencies: {
      '@nestjs/passport': '10.0.3',
      'passport-local': '1.0.0',
      'passport-jwt': '4.0.1',
    },
    devDependencies: {
      '@types/passport-local': '1.0.38',
      '@types/passport-jwt': '4.0.1',
    },
    envVars: [
      {
        key: 'JWT_SECRET',
        defaultValue: 'change-me-in-production',
        description: 'JWT signing secret',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'microservice', 'full-stack', 'monorepo'],
    templateDir: 'passport',
    claudeMdSection: [
      '## Passport Strategies',
      'Local strategy handles username/password login. JWT strategy validates bearer tokens.',
      'Create custom strategies by extending PassportStrategy(Strategy).',
    ].join('\n'),
    cursorRules: [
      'Extend PassportStrategy for custom auth strategies. Use @UseGuards(AuthGuard("strategy-name")).',
      'The local strategy validates credentials; JWT strategy protects subsequent requests.',
    ].join('\n'),
    copilotInstructions: [
      'Passport.js is integrated via @nestjs/passport with local and JWT strategies.',
      'Use AuthGuard("local") for login and AuthGuard("jwt") for protected routes.',
    ].join('\n'),
  },
  {
    id: 'auth-flows',
    name: 'Auth Flows',
    description: 'Complete signup, email verification, and password reset flows',
    category: 'Auth',
    dependencies: {
      '@nestjs/jwt': '10.2.0',
      bcrypt: '6.0.0',
      uuid: '11.1.0',
    },
    devDependencies: {
      '@types/bcrypt': '5.0.2',
    },
    envVars: [
      {
        key: 'AUTH_JWT_SECRET',
        defaultValue: 'change-me-in-production',
        description: 'JWT secret used for auth flow tokens (email verification, password reset)',
      },
      {
        key: 'AUTH_EMAIL_VERIFICATION_URL',
        defaultValue: 'http://localhost:3000/verify-email',
        description: 'Base URL for email verification links sent to users',
      },
      {
        key: 'AUTH_PASSWORD_RESET_URL',
        defaultValue: 'http://localhost:3000/reset-password',
        description: 'Base URL for password reset links sent to users',
      },
    ],
    conflicts: [],
    requires: ['jwt-auth'],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'auth-flows',
    claudeMdSection: [
      '## Auth Flows',
      'AuthService handles signup, login, email verification, and password reset.',
      'Passwords are hashed with bcrypt. Wire in your own UserRepository and email transport.',
    ].join('\n'),
    cursorRules: [
      'AuthService provides signup, login, verifyEmail, forgotPassword, resetPassword.',
      'Replace the in-memory user store with a real UserRepository. Plug in your email service for transactional emails.',
    ].join('\n'),
    copilotInstructions: [
      'Auth flows use bcrypt for password hashing and uuid for token generation.',
      'Wire AuthService to a real user repository and email service before going to production.',
    ].join('\n'),
  },
  {
    id: 'api-keys',
    name: 'API Key Authentication',
    description: 'API key-based authentication with custom guard',
    category: 'Auth',
    dependencies: {},
    devDependencies: {},
    envVars: [
      { key: 'API_KEY_HEADER', defaultValue: 'x-api-key', description: 'Header name for API key' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'microservice', 'full-stack', 'monorepo'],
    templateDir: 'api-keys',
    claudeMdSection: [
      '## API Key Authentication',
      'Apply @UseGuards(ApiKeyGuard) to routes requiring API key auth.',
      'API keys are validated against stored keys. Rotate keys without downtime by supporting multiple active keys.',
    ].join('\n'),
    cursorRules: [
      'Use ApiKeyGuard for machine-to-machine authentication. API keys are sent in the x-api-key header.',
      'Store hashed API keys in the database. Support key rotation with multiple active keys.',
    ].join('\n'),
    copilotInstructions: [
      'API key auth uses a custom guard. Apply @UseGuards(ApiKeyGuard) to protect routes.',
      'Keys are validated from the x-api-key header. Store only hashed keys in the database.',
    ].join('\n'),
  },
  {
    id: 'oauth2-introspection',
    name: 'OAuth 2.0 Token Introspection',
    description: 'RFC 7662 token introspection for validating opaque tokens',
    category: 'Auth',
    dependencies: {},
    devDependencies: {},
    envVars: [
      {
        key: 'OAUTH2_INTROSPECTION_URL',
        defaultValue: 'https://auth.example.com/oauth2/introspect',
        description: 'Token introspection endpoint URL',
      },
      {
        key: 'OAUTH2_CLIENT_ID',
        defaultValue: '',
        description: 'OAuth 2.0 client ID for introspection',
      },
      {
        key: 'OAUTH2_CLIENT_SECRET',
        defaultValue: '',
        description: 'OAuth 2.0 client secret for introspection',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'microservice', 'full-stack', 'monorepo'],
    templateDir: 'oauth2-introspection',
    claudeMdSection:
      '## OAuth 2.0 Token Introspection\nUse the TokenIntrospectionGuard on routes that accept opaque OAuth tokens. The guard calls the introspection endpoint per RFC 7662.',
    cursorRules:
      'Use TokenIntrospectionGuard for opaque token validation. JWT tokens should use the jwt-auth recipe instead.',
    copilotInstructions:
      'OAuth 2.0 token introspection (RFC 7662) validates opaque tokens via the introspection endpoint.',
  },

  {
    id: 'rbac-casl',
    name: 'RBAC Authorization (CASL)',
    description: 'Role-based access control with CASL ability factory',
    category: 'Auth',
    dependencies: {
      '@casl/ability': '6.7.3',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'rbac-casl',
    claudeMdSection: [
      '## RBAC Authorization (CASL)',
      'Use @Roles(Role.Admin) for simple role checks and @CheckPolicies(handler) for fine-grained CASL policies.',
      'The CaslAbilityFactory defines per-role permissions. Register PoliciesGuard and RolesGuard as needed.',
    ].join('\n'),
    cursorRules: [
      'Use @Roles() for coarse role checks and @CheckPolicies() for attribute-based access control.',
      'Define abilities in CaslAbilityFactory. Never hardcode permission checks — always use guards and decorators.',
    ].join('\n'),
    copilotInstructions: [
      'RBAC uses CASL for authorization. Apply @Roles(Role.Admin) or @CheckPolicies(handler) to endpoints.',
      'Permissions are defined in CaslAbilityFactory. Use PoliciesGuard for policy-based and RolesGuard for role-based access.',
    ].join('\n'),
  },

  // ─── API Docs ───────────────────────────────────────────────────────
  {
    id: 'swagger',
    name: 'Swagger / OpenAPI',
    description: 'Auto-generated OpenAPI documentation with Swagger UI',
    category: 'API Docs',
    dependencies: {
      '@nestjs/swagger': '11.4.2',
      '@fastify/static': '8.1.0',
    },
    expressDependencies: {
      '@nestjs/swagger': '11.4.2',
    },
    devDependencies: {},
    envVars: [
      { key: 'SWAGGER_ENABLED', defaultValue: 'true', description: 'Enable Swagger UI' },
      { key: 'SWAGGER_PATH', defaultValue: 'api/docs', description: 'Swagger UI URL path' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo', 'aws-lambda'],
    templateDir: 'swagger',
    claudeMdSection: [
      '## Swagger / OpenAPI',
      'Swagger UI is available at `/{SWAGGER_PATH}`. Use @ApiTags(), @ApiOperation(), and @ApiResponse() on controllers.',
      'DTOs are auto-documented via the Swagger plugin — ensure DTOs use class-validator decorators.',
    ].join('\n'),
    cursorRules: [
      'Decorate all controllers with @ApiTags() and endpoints with @ApiOperation()/@ApiResponse().',
      'The Swagger CLI plugin auto-documents DTOs. Add @ApiProperty() only for complex/optional fields.',
    ].join('\n'),
    copilotInstructions: [
      'Swagger is configured with @nestjs/swagger. Decorate controllers with @ApiTags() and methods with @ApiOperation().',
      'DTOs are auto-scanned. Use @ApiProperty() for fields that need extra documentation.',
    ].join('\n'),
    mainTsSetup: {
      blockId: 'swagger',
      block: {
        imports: [
          {
            namedImports: ['DocumentBuilder', 'SwaggerModule'],
            moduleSpecifier: '@nestjs/swagger',
          },
        ],
        code: `  const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('API')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(process.env.SWAGGER_PATH ?? 'api/docs', app, document);
  }`,
      },
    },
  },

  // ─── Logging ────────────────────────────────────────────────────────
  {
    id: 'pino',
    name: 'Pino Logger',
    description: 'Structured JSON logging with Pino',
    category: 'Logging',
    dependencies: {
      'nestjs-pino': '4.2.0',
      pino: '9.6.0',
    },
    devDependencies: {
      'pino-pretty': '13.0.0',
    },
    envVars: [
      {
        key: 'LOG_LEVEL',
        defaultValue: 'info',
        description: 'Pino log level (trace, debug, info, warn, error, fatal)',
      },
    ],
    conflicts: ['winston'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'pino',
    claudeMdSection: [
      '## Pino Logger',
      'Use `PinoLogger` (injected) for structured logging. Logs are JSON in production, pretty-printed in dev.',
      'Set log level via LOG_LEVEL env var. Use `logger.assign()` to add context fields.',
    ].join('\n'),
    cursorRules: [
      'Inject PinoLogger for logging. Never use console methods — all logs go through Pino.',
      'Use logger.assign({ key: value }) for adding context. Logs are structured JSON in production.',
    ].join('\n'),
    copilotInstructions: [
      'Pino is the logger. Inject PinoLogger and use .info(), .warn(), .error() methods.',
      'Avoid console methods. Use pino-pretty in development. Logs are JSON in production.',
    ].join('\n'),
  },
  {
    id: 'winston',
    name: 'Winston Logger',
    description: 'Flexible logging with Winston transports',
    category: 'Logging',
    dependencies: {
      'nest-winston': '1.10.2',
      winston: '3.17.0',
    },
    devDependencies: {},
    envVars: [{ key: 'LOG_LEVEL', defaultValue: 'info', description: 'Winston log level' }],
    conflicts: ['pino'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'winston',
    claudeMdSection: [
      '## Winston Logger',
      'Winston is configured with console and file transports. Inject `WINSTON_MODULE_PROVIDER` for the logger.',
      'Add custom transports (e.g., Elasticsearch, CloudWatch) in the WinstonModule configuration.',
    ].join('\n'),
    cursorRules: [
      'Use the injected Winston logger, never console methods. Configure transports in the module setup.',
      'Use log levels consistently: error for failures, warn for degraded, info for operations, debug for dev.',
    ].join('\n'),
    copilotInstructions: [
      'Winston handles logging. Inject the logger via WINSTON_MODULE_PROVIDER token.',
      'Multiple transports are configured. Use structured metadata objects in log calls.',
    ].join('\n'),
  },

  // ─── Monitoring ─────────────────────────────────────────────────────
  {
    id: 'health-checks',
    name: 'Health Checks',
    description: 'Health check endpoints with Terminus',
    category: 'Monitoring',
    dependencies: {
      '@nestjs/terminus': '10.2.3',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'health-checks',
    claudeMdSection: [
      '## Health Checks',
      'GET `/health` returns service health. Add custom indicators by implementing HealthIndicator.',
      'Includes disk, memory, and database checks out of the box.',
    ].join('\n'),
    cursorRules: [
      'Health endpoint is at /health. Add custom checks by extending HealthIndicator.',
      'Include checks for all external dependencies (DB, Redis, queues) the service uses.',
    ].join('\n'),
    copilotInstructions: [
      'Terminus health checks are at /health. Custom indicators extend HealthIndicator.',
      'Add checks for every external dependency. Use @HealthCheck() decorator on the controller method.',
    ].join('\n'),
  },
  {
    id: 'prometheus',
    name: 'Prometheus Metrics',
    description: 'Expose application metrics for Prometheus scraping',
    category: 'Monitoring',
    dependencies: {
      'prom-client': '15.1.3',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'METRICS_PATH',
        defaultValue: '/metrics',
        description: 'Prometheus metrics endpoint path',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'prometheus',
    claudeMdSection: [
      '## Prometheus Metrics',
      'Metrics are exposed at `/{METRICS_PATH}`. Default metrics are collected automatically.',
      'Create custom metrics (Counter, Histogram, Gauge) in dedicated metric services.',
    ].join('\n'),
    cursorRules: [
      'Use prom-client to define custom metrics. Register metrics in module providers.',
      'Use Histogram for request durations, Counter for totals, Gauge for current values.',
    ].join('\n'),
    copilotInstructions: [
      'Prometheus metrics are at /metrics via prom-client. Default Node.js metrics are auto-collected.',
      'Define custom metrics as injectable services. Use histogram.observe() and counter.inc().',
    ].join('\n'),
  },

  // ─── Error Tracking ────────────────────────────────────────────────
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error tracking and performance monitoring with Sentry',
    category: 'Error Tracking',
    dependencies: {
      '@sentry/nestjs': '8.48.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'SENTRY_DSN', defaultValue: '', description: 'Sentry project DSN' },
      {
        key: 'SENTRY_ENVIRONMENT',
        defaultValue: 'development',
        description: 'Sentry environment tag',
      },
      {
        key: 'SENTRY_TRACES_SAMPLE_RATE',
        defaultValue: '1.0',
        description: 'Sentry performance traces sample rate',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'sentry',
    claudeMdSection: [
      '## Sentry',
      'Sentry captures unhandled exceptions and performance data. Configure via SENTRY_DSN.',
      'Use Sentry.captureException() for manual error reporting. Add tags/context with Sentry.setTag().',
    ].join('\n'),
    cursorRules: [
      'Sentry is initialized at app startup. Unhandled exceptions are auto-captured.',
      'Use Sentry.captureException() for caught errors. Add context with Sentry.setTag/setContext.',
    ].join('\n'),
    copilotInstructions: [
      'Sentry captures errors automatically. Use Sentry.captureException() for explicit reporting.',
      'Set SENTRY_DSN in environment. Performance tracing is enabled by default.',
    ].join('\n'),
  },
  {
    id: 'seq2',
    name: 'Seq',
    description: 'Structured log aggregation with Seq',
    category: 'Error Tracking',
    dependencies: {
      'seq-logging': '3.0.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'SEQ_SERVER_URL',
        defaultValue: 'http://localhost:5341',
        description: 'Seq server URL',
      },
      { key: 'SEQ_API_KEY', defaultValue: '', description: 'Seq API key' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'seq2',
    claudeMdSection: [
      '## Seq',
      'Structured logs are forwarded to Seq at SEQ_SERVER_URL.',
      'Use structured properties in log messages for searchability in the Seq dashboard.',
    ].join('\n'),
    cursorRules: [
      'Seq receives structured logs. Always include meaningful properties in log entries.',
      'Use message templates with named properties for Seq filtering and alerting.',
    ].join('\n'),
    copilotInstructions: [
      'Seq is configured for log aggregation. Logs are sent to SEQ_SERVER_URL.',
      'Use structured logging properties for effective filtering in the Seq UI.',
    ].join('\n'),
  },

  // ─── Storage ────────────────────────────────────────────────────────
  {
    id: 's3-minio',
    name: 'S3 / MinIO Storage',
    description: 'Object storage with AWS S3 SDK (compatible with MinIO)',
    category: 'Storage',
    dependencies: {
      '@aws-sdk/client-s3': '3.712.0',
      '@aws-sdk/s3-request-presigner': '3.712.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'S3_ENDPOINT',
        defaultValue: 'http://localhost:9000',
        description: 'S3/MinIO endpoint',
      },
      { key: 'S3_REGION', defaultValue: 'us-east-1', description: 'S3 region' },
      { key: 'S3_BUCKET', defaultValue: 'app-uploads', description: 'Default S3 bucket name' },
      { key: 'S3_ACCESS_KEY_ID', defaultValue: 'minioadmin', description: 'S3/MinIO access key' },
      { key: 'S3_SECRET_ACCESS_KEY', defaultValue: 'minioadmin', description: 'S3/MinIO secret key' },
    ],
    conflicts: ['aws-s3'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 's3-minio',
    claudeMdSection: [
      '## S3 / MinIO Storage',
      'Use StorageService for file uploads, downloads, and presigned URLs.',
      'MinIO is used locally; configure S3_ENDPOINT to switch to AWS S3 in production.',
    ].join('\n'),
    cursorRules: [
      'Use the StorageService abstraction, not S3Client directly in business code.',
      'Generate presigned URLs for client-side uploads. Set appropriate content-type and size limits.',
    ].join('\n'),
    copilotInstructions: [
      'S3-compatible storage via @aws-sdk/client-s3. Use StorageService for all file operations.',
      'MinIO is the local dev replacement. Presigned URLs are used for direct browser uploads.',
    ].join('\n'),
  },

  // ─── Email ──────────────────────────────────────────────────────────
  {
    id: 'nodemailer',
    name: 'Nodemailer',
    description: 'Email sending with Nodemailer and template support',
    category: 'Email',
    dependencies: {
      '@nestjs-modules/mailer': '2.0.2',
      nodemailer: '6.9.16',
      handlebars: '4.7.8',
    },
    devDependencies: {
      '@types/nodemailer': '6.4.17',
    },
    envVars: [
      { key: 'MAIL_HOST', defaultValue: 'localhost', description: 'SMTP host' },
      { key: 'MAIL_PORT', defaultValue: '1025', description: 'SMTP port' },
      { key: 'MAIL_USER', defaultValue: '', description: 'SMTP username' },
      { key: 'MAIL_PASSWORD', defaultValue: '', description: 'SMTP password' },
      {
        key: 'MAIL_FROM',
        defaultValue: 'noreply@example.com',
        description: 'Default sender address',
      },
    ],
    conflicts: ['sendgrid'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'nodemailer',
    claudeMdSection: [
      '## Nodemailer',
      'Inject MailerService to send emails. Templates live in `src/mail/templates/`.',
      'Use MailHog or similar SMTP trap locally. Configure real SMTP credentials in production.',
    ].join('\n'),
    cursorRules: [
      'Use MailerService for sending emails. Email templates are in src/mail/templates/.',
      'Never hardcode email credentials. Use SMTP trap (MailHog) for local development.',
    ].join('\n'),
    copilotInstructions: [
      'Nodemailer is integrated via @nestjs-modules/mailer. Inject MailerService to send mail.',
      'Templates are in src/mail/templates/. Use MailHog locally for testing email delivery.',
    ].join('\n'),
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Transactional email via SendGrid API',
    category: 'Email',
    dependencies: {
      '@sendgrid/mail': '8.1.4',
    },
    devDependencies: {},
    envVars: [
      { key: 'SENDGRID_API_KEY', defaultValue: '', description: 'SendGrid API key' },
      {
        key: 'SENDGRID_FROM_EMAIL',
        defaultValue: 'noreply@example.com',
        description: 'Default sender address',
      },
    ],
    conflicts: ['nodemailer'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'sendgrid',
    claudeMdSection: [
      '## SendGrid',
      'Use EmailService to send transactional emails via SendGrid. Set SENDGRID_API_KEY in env.',
      'Use dynamic templates in the SendGrid dashboard for managed email templates.',
    ].join('\n'),
    cursorRules: [
      'Use the EmailService wrapper, not @sendgrid/mail directly. API key from ConfigService.',
      'Prefer SendGrid dynamic templates over inline HTML for production emails.',
    ].join('\n'),
    copilotInstructions: [
      'SendGrid handles email sending. Use the EmailService abstraction layer.',
      'Configure SENDGRID_API_KEY via environment. Use dynamic templates for production.',
    ].join('\n'),
  },

  // ─── WebSockets ─────────────────────────────────────────────────────
  {
    id: 'websockets',
    name: 'WebSockets',
    description: 'Real-time communication with Socket.IO',
    category: 'WebSockets',
    dependencies: {
      '@nestjs/websockets': '11.1.19',
      '@nestjs/platform-socket.io': '11.1.19',
      'socket.io': '4.8.3',
    },
    devDependencies: {},
    envVars: [{ key: 'WS_PORT', defaultValue: '3001', description: 'WebSocket server port' }],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'websockets',
    claudeMdSection: [
      '## WebSockets',
      'Use @WebSocketGateway() for real-time gateways. Handle events with @SubscribeMessage().',
      'Socket.IO is the underlying transport. Use rooms and namespaces for channel isolation.',
    ].join('\n'),
    cursorRules: [
      'Create gateways with @WebSocketGateway(). Handle events via @SubscribeMessage().',
      'Use rooms for scoped broadcasting. Authenticate WebSocket connections in handleConnection().',
    ].join('\n'),
    copilotInstructions: [
      'WebSockets use Socket.IO via @nestjs/websockets. Create gateways with @WebSocketGateway().',
      'Use @SubscribeMessage() for event handlers. Rooms and namespaces manage channel isolation.',
    ].join('\n'),
  },

  // ─── GraphQL ────────────────────────────────────────────────────────
  {
    id: 'graphql-mercurius',
    name: 'GraphQL (Mercurius)',
    description: 'GraphQL API with Mercurius adapter for Fastify',
    category: 'GraphQL',
    dependencies: {
      '@nestjs/graphql': '12.2.1',
      '@nestjs/mercurius': '12.2.1',
      mercurius: '15.0.0',
      graphql: '16.9.0',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'graphql-mercurius',
    claudeMdSection: [
      '## GraphQL (Mercurius)',
      'Code-first approach: define @ObjectType() and @Resolver() classes. Schema is auto-generated.',
      'GraphQL playground is available at `/graphql` in non-production environments.',
    ].join('\n'),
    cursorRules: [
      'Use code-first approach with @ObjectType(), @Field(), @Resolver(), @Query(), @Mutation().',
      'Define input types with @InputType(). Use DataLoader for N+1 query prevention.',
    ].join('\n'),
    copilotInstructions: [
      'GraphQL uses Mercurius with code-first approach. Define resolvers with @Resolver() decorator.',
      'Use @ObjectType/@Field for types, @Query/@Mutation for operations. DataLoader prevents N+1.',
    ].join('\n'),
  },

  // ─── CQRS ───────────────────────────────────────────────────────────
  {
    id: 'cqrs',
    name: 'CQRS',
    description: 'Command Query Responsibility Segregation pattern',
    category: 'CQRS',
    dependencies: {
      '@nestjs/cqrs': '10.2.7',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cqrs',
    claudeMdSection: [
      '## CQRS',
      'Separate commands (writes) and queries (reads). Use CommandBus and QueryBus for dispatching.',
      'Events are emitted via EventBus. Sagas handle cross-aggregate side effects.',
    ].join('\n'),
    cursorRules: [
      'Commands go through CommandBus, queries through QueryBus. One handler per command/query.',
      'Events are dispatched via EventBus. Place handlers in the same module as the aggregate.',
    ].join('\n'),
    copilotInstructions: [
      'CQRS is via @nestjs/cqrs. Dispatch commands with CommandBus, queries with QueryBus.',
      'Each command/query has exactly one handler. Use events for side effects across modules.',
    ].join('\n'),
  },

  // ─── Security ───────────────────────────────────────────────────────
  {
    id: 'throttler',
    name: 'Rate Limiting',
    description: 'Request rate limiting with Throttler',
    category: 'Security',
    dependencies: {
      '@nestjs/throttler': '6.3.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'THROTTLE_TTL',
        defaultValue: '60000',
        description: 'Rate limit window in milliseconds',
      },
      { key: 'THROTTLE_LIMIT', defaultValue: '100', description: 'Max requests per window' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'throttler',
    claudeMdSection: [
      '## Rate Limiting',
      'Global rate limiting is applied via ThrottlerGuard. Override per-route with @Throttle().',
      'Skip rate limiting on specific routes with @SkipThrottle().',
    ].join('\n'),
    cursorRules: [
      'ThrottlerGuard is applied globally. Use @Throttle() to customize per-route limits.',
      'Use @SkipThrottle() for internal/health endpoints. Configure via THROTTLE_TTL and THROTTLE_LIMIT.',
    ].join('\n'),
    copilotInstructions: [
      'Rate limiting uses @nestjs/throttler. Global guard is applied. Override with @Throttle() per route.',
      'Use @SkipThrottle() to exempt specific endpoints like health checks.',
    ].join('\n'),
  },
  {
    id: 'helmet',
    name: 'Helmet',
    description: 'HTTP security headers',
    category: 'Security',
    dependencies: {
      '@fastify/helmet': '13.0.2',
    },
    expressDependencies: {
      helmet: '8.1.0',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'helmet',
    claudeMdSection: [
      '## Helmet',
      'Helmet sets security headers (CSP, X-Frame-Options, etc.) automatically.',
      'Customize header policies in the Helmet registration options.',
    ].join('\n'),
    cursorRules: [
      'Helmet is registered in main.ts. Customize CSP and other policies as needed.',
      'Ensure CSP allows required script/style sources when using Swagger UI or frontends.',
    ].join('\n'),
    copilotInstructions: [
      'Helmet applies security headers. Configured in main.ts.',
      'Adjust CSP directives if Swagger UI or external resources are blocked.',
    ].join('\n'),
    mainTsSetup: {
      blockId: 'helmet',
      block: {
        imports: [
          {
            defaultImport: 'helmet',
            namedImports: [],
            moduleSpecifier: '@fastify/helmet',
          },
        ],
        code: `  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });`,
      },
    },
    expressMainTsSetup: {
      blockId: 'helmet',
      block: {
        imports: [
          {
            defaultImport: 'helmet',
            namedImports: [],
            moduleSpecifier: 'helmet',
          },
        ],
        code: `  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );`,
      },
    },
  },
  {
    id: 'cors',
    name: 'CORS',
    description: 'Cross-Origin Resource Sharing configuration',
    category: 'Security',
    dependencies: {},
    devDependencies: {},
    envVars: [
      {
        key: 'CORS_ORIGIN',
        defaultValue: 'http://localhost:3000',
        description: 'Allowed CORS origin(s), comma-separated',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'cors',
    claudeMdSection: [
      '## CORS',
      'CORS is configured in main.ts. Allowed origins are set via CORS_ORIGIN env var.',
      'Use comma-separated values for multiple origins. Never use `*` in production.',
    ].join('\n'),
    cursorRules: [
      'CORS origins come from CORS_ORIGIN env var. Never wildcard in production.',
      'Configure credentials, methods, and headers in the CORS options in main.ts.',
    ].join('\n'),
    copilotInstructions: [
      'CORS is configured in main.ts via app.enableCors(). Origins from CORS_ORIGIN env var.',
      'Support comma-separated origins. Never use wildcard (*) in production environments.',
    ].join('\n'),
  },
  {
    id: 'csrf',
    name: 'CSRF Protection',
    description: 'Cross-Site Request Forgery protection',
    category: 'Security',
    dependencies: {
      '@fastify/csrf-protection': '7.0.1',
      '@fastify/cookie': '11.0.1',
    },
    expressDependencies: {
      'csrf-csrf': '3.0.6',
      'cookie-parser': '1.4.7',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'csrf',
    claudeMdSection: [
      '## CSRF Protection',
      'CSRF tokens are required for state-changing requests. Token is set via cookie.',
      'Exclude API routes that use bearer token auth from CSRF protection.',
    ].join('\n'),
    cursorRules: [
      'CSRF protection is cookie-based. Check main.ts for the registration.',
      'API endpoints using JWT/API-key auth can skip CSRF. Browser-facing forms need it.',
    ].join('\n'),
    copilotInstructions: [
      'CSRF protection is applied to browser-facing state-changing routes. See main.ts for configuration.',
      'JWT/API-key protected endpoints can be excluded. Token is delivered via cookie.',
    ].join('\n'),
  },

  // ─── API Patterns ──────────────────────────────────────────────────
  {
    id: 'pagination',
    name: 'Pagination',
    description: 'Cursor and offset pagination utilities',
    category: 'API Patterns',
    dependencies: {
      '@nestjs/swagger': '11.4.2',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'pagination',
    claudeMdSection: [
      '## Pagination',
      'Use PaginatedQuery for query params (page, limit). PaginatedResponse<T> wraps results with metadata.',
      'Supports offset-based pagination. Use PaginatedQuery.skip for database offset calculations.',
    ].join('\n'),
    cursorRules: [
      'Use PaginatedQuery for pagination query params. Return PaginatedResponse<T> from endpoints.',
      'Default page size is 20, max 100. Use PaginatedQuery.skip for offset calculations.',
    ].join('\n'),
    copilotInstructions: [
      'Pagination uses PaginatedQuery and PaginatedResponse<T>. Offset-based with skip/limit.',
      'Apply @Query() PaginatedQuery to controller methods. Service returns PaginatedResponse<T> wrapper.',
    ].join('\n'),
  },
  {
    id: 'filtering',
    name: 'Filtering',
    description: 'Dynamic query filtering utilities',
    category: 'API Patterns',
    dependencies: {
      '@nestjs/swagger': '11.4.2',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'filtering',
    claudeMdSection: [
      '## Filtering',
      'Use FilterDto base class for query filters. Supports equals, contains, gt/lt, in operators.',
      'Apply @Query() with filter DTOs to controller methods for type-safe filtering.',
    ].join('\n'),
    cursorRules: [
      'Extend FilterDto for resource-specific filters. Supported operators: eq, contains, gt, lt, in.',
      'Validate filter values via class-validator. Map filter DTOs to ORM query conditions.',
    ].join('\n'),
    copilotInstructions: [
      'Query filtering uses FilterDto pattern. Extend per resource for type-safe filters.',
      'Map filter DTOs to database queries in the service layer. Validate with class-validator.',
    ].join('\n'),
  },
  {
    id: 'api-versioning',
    name: 'API Versioning',
    description: 'URI or header-based API versioning',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'api-versioning',
    claudeMdSection: [
      '## API Versioning',
      'URI versioning is enabled: `/v1/resource`, `/v2/resource`. Use @Version() on controllers.',
      'Default version is set in main.ts. Use VERSION_NEUTRAL for unversioned routes.',
    ].join('\n'),
    cursorRules: [
      'Use @Version("1") on controllers or methods. Default version is configured globally.',
      'Deprecate old versions with @ApiDeprecated() and a sunset date in response headers.',
    ].join('\n'),
    copilotInstructions: [
      'API versioning uses URI prefix (/v1/). Apply @Version() decorator to controllers.',
      'Set default version in main.ts. Use VERSION_NEUTRAL for unversioned endpoints.',
    ].join('\n'),
  },
  {
    id: 'correlation-id',
    name: 'Correlation ID',
    description: 'Request correlation ID propagation via AsyncLocalStorage',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'correlation-id',
    claudeMdSection: [
      '## Correlation ID',
      'Every request gets a correlation ID (from x-correlation-id header or auto-generated UUID).',
      'Access via getCorrelationId() from anywhere in the async call chain. Propagate to downstream HTTP calls and log entries.',
    ].join('\n'),
    cursorRules: [
      'Correlation ID is set via CorrelationIdMiddleware using AsyncLocalStorage. Access via getCorrelationId().',
      'Always forward the correlation ID in outgoing HTTP calls and include it in log context.',
    ].join('\n'),
    copilotInstructions: [
      'Correlation IDs track requests across services. Auto-generated or from x-correlation-id header.',
      'Use getCorrelationId() to access from anywhere in the async call chain. Propagate in outgoing HTTP headers and logs.',
    ].join('\n'),
  },

  {
    id: 'http-caching',
    name: 'HTTP Cache Headers',
    description: 'RFC 9111 Cache-Control and conditional request headers',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'http-caching',
    claudeMdSection:
      '## HTTP Caching\nUse @CacheControl() decorator on GET endpoints to set Cache-Control headers. Supports max-age, s-maxage, stale-while-revalidate, no-cache, no-store, private, public directives.',
    cursorRules:
      'Use @CacheControl() decorator for response caching headers. Set appropriate max-age per endpoint. Use no-cache for authenticated endpoints.',
    copilotInstructions:
      'HTTP Cache-Control headers via @CacheControl() decorator. Apply to GET endpoints. Authenticated endpoints should use no-cache or private.',
  },

  // ─── Observability ──────────────────────────────────────────────────
  {
    id: 'opentelemetry',
    name: 'OpenTelemetry',
    description: 'Distributed tracing and metrics with OpenTelemetry SDK',
    category: 'Observability',
    dependencies: {
      '@opentelemetry/sdk-node': '0.57.0',
      '@opentelemetry/exporter-trace-otlp-http': '0.57.0',
      '@opentelemetry/instrumentation-http': '0.57.0',
      '@opentelemetry/instrumentation-fastify': '0.44.0',
      '@opentelemetry/resources': '1.30.0',
      '@opentelemetry/semantic-conventions': '1.28.0',
    },
    expressDependencies: {
      '@opentelemetry/sdk-node': '0.57.0',
      '@opentelemetry/exporter-trace-otlp-http': '0.57.0',
      '@opentelemetry/instrumentation-http': '0.57.0',
      '@opentelemetry/instrumentation-express': '0.47.0',
      '@opentelemetry/resources': '1.30.0',
      '@opentelemetry/semantic-conventions': '1.28.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'OTEL_EXPORTER_OTLP_ENDPOINT',
        defaultValue: 'http://localhost:4318',
        description: 'OpenTelemetry collector endpoint',
      },
      {
        key: 'OTEL_SERVICE_NAME',
        defaultValue: 'nestjs-app',
        description: 'Service name for traces',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'opentelemetry',
    claudeMdSection: [
      '## OpenTelemetry',
      'OTel is initialized in `src/instrumentation.ts` (loaded before app bootstrap).',
      'Auto-instrumentation captures HTTP, database, and external call spans automatically.',
    ].join('\n'),
    cursorRules: [
      'OpenTelemetry is initialized in instrumentation.ts via --require flag. Auto-instrumentation is enabled.',
      'Add custom spans with tracer.startSpan(). Export to Jaeger/OTLP collector.',
    ].join('\n'),
    copilotInstructions: [
      'OpenTelemetry handles tracing. Instrumentation file loads before the app via --require.',
      'Auto-instrumentation covers HTTP/DB. Add custom spans for business-critical operations.',
    ].join('\n'),
  },
  {
    id: 'request-logging',
    name: 'Request Logging',
    description: 'HTTP request/response logging middleware',
    category: 'Observability',
    dependencies: {},
    devDependencies: {},
    envVars: [
      {
        key: 'REQUEST_LOG_BODY',
        defaultValue: 'false',
        description: 'Log request/response bodies',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'request-logging',
    claudeMdSection: [
      '## Request Logging',
      'All HTTP requests are logged with method, URL, status, and duration.',
      'Enable body logging with REQUEST_LOG_BODY=true (disable in production for PII safety).',
    ].join('\n'),
    cursorRules: [
      'Request logging middleware captures method, URL, status code, and response time.',
      'Body logging is opt-in. Redact sensitive fields (password, token) before logging.',
    ].join('\n'),
    copilotInstructions: [
      'Request/response logging middleware is applied globally. Logs method, URL, status, duration.',
      'Body logging is off by default. Always redact sensitive fields when enabling.',
    ].join('\n'),
  },
  {
    id: 'distributed-tracing',
    name: 'Distributed Tracing',
    description: 'Trace context propagation across services',
    category: 'Observability',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'distributed-tracing',
    claudeMdSection: [
      '## Distributed Tracing',
      'W3C Trace Context headers (traceparent, tracestate) are propagated across service calls.',
      'Middleware extracts incoming trace context; HttpService forwards it to outgoing requests.',
    ].join('\n'),
    cursorRules: [
      'Trace context is propagated via W3C traceparent header. Middleware handles extraction.',
      'All outgoing HTTP calls must forward trace headers. Use the provided HttpService wrapper.',
    ].join('\n'),
    copilotInstructions: [
      'Distributed tracing propagates W3C traceparent/tracestate headers across services.',
      'Middleware extracts context; HttpService wrapper forwards it to downstream calls.',
    ].join('\n'),
  },

  // ─── DX ─────────────────────────────────────────────────────────────
  {
    id: 'devcontainer',
    name: 'Dev Container',
    description: 'VS Code Dev Container configuration',
    category: 'DX',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'devcontainer',
    claudeMdSection: [
      '## Dev Container',
      'Open in VS Code with "Reopen in Container" for a fully configured dev environment.',
      'Docker Compose services (DB, Redis, etc.) start automatically with the container.',
    ].join('\n'),
    cursorRules: [
      'Dev Container config is in .devcontainer/. Includes all project dependencies.',
      'Port forwarding, extensions, and environment are pre-configured.',
    ].join('\n'),
    copilotInstructions: [
      'Dev Container is configured in .devcontainer/. Use "Reopen in Container" in VS Code.',
      'All services and tools are pre-installed. No local setup needed.',
    ].join('\n'),
  },
  {
    id: 'database-seeding',
    name: 'Database Seeding',
    description: 'Database seed command for development data',
    category: 'DX',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'database-seeding',
    claudeMdSection: [
      '## Database Seeding',
      'Run `pnpm seed` to populate the database with development data.',
      'Seed files are in `src/database/seeds/`. Seeds are idempotent — safe to run multiple times.',
    ].join('\n'),
    cursorRules: [
      'Seeds live in src/database/seeds/. Each seed class implements the Seeder interface.',
      'Seeds must be idempotent. Use upsert logic to avoid duplicates on re-runs.',
    ].join('\n'),
    copilotInstructions: [
      'Database seeding via `pnpm seed`. Seed files in src/database/seeds/ implement Seeder.',
      'All seeds are idempotent and can be run repeatedly without side effects.',
    ].join('\n'),
  },
  {
    id: 'database-factories',
    name: 'Database Factories',
    description: 'Test data factories for database entities',
    category: 'DX',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'database-factories',
    claudeMdSection: [
      '## Database Factories',
      'Use factories to create test data: `UserFactory.create({ name: "Test" })`.',
      'Factories are in `src/database/factories/`. Override any field in the create() call.',
    ].join('\n'),
    cursorRules: [
      'Factories are in src/database/factories/. Each entity has a corresponding factory.',
      'Use Factory.create() with overrides in tests. Factories use realistic default values.',
    ].join('\n'),
    copilotInstructions: [
      'Test data factories in src/database/factories/. Use EntityFactory.create() in tests.',
      'Pass partial overrides to customize. Defaults produce valid, realistic data.',
    ].join('\n'),
  },
  {
    id: 'sdk-generation',
    name: 'SDK Generation',
    description: 'Auto-generate client SDKs from OpenAPI spec',
    category: 'DX',
    dependencies: {},
    devDependencies: {
      '@openapitools/openapi-generator-cli': '2.15.3',
    },
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'sdk-generation',
    claudeMdSection: [
      '## SDK Generation',
      'Run `pnpm generate:sdk` to generate a TypeScript client SDK from the OpenAPI spec.',
      'Output is in `generated/sdk/`. Commit the generated SDK or publish as an npm package.',
    ].join('\n'),
    cursorRules: [
      'SDK is auto-generated from OpenAPI spec. Do not manually edit files in generated/sdk/.',
      'Run `pnpm generate:sdk` after changing API endpoints. Commit generated output.',
    ].join('\n'),
    copilotInstructions: [
      'Client SDK is generated from OpenAPI via openapi-generator-cli. Run `pnpm generate:sdk`.',
      'Output in generated/sdk/ is auto-generated — do not edit manually.',
    ].join('\n'),
  },

  // ─── Operational ────────────────────────────────────────────────────
  {
    id: 'graceful-shutdown',
    name: 'Graceful Shutdown',
    description: 'Clean shutdown handling for connections and in-flight requests',
    category: 'Operational',
    dependencies: {},
    devDependencies: {},
    envVars: [
      {
        key: 'SHUTDOWN_TIMEOUT_MS',
        defaultValue: '10000',
        description: 'Max wait time for graceful shutdown',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'graceful-shutdown',
    claudeMdSection: [
      '## Graceful Shutdown',
      'SIGTERM/SIGINT trigger graceful shutdown. In-flight requests complete before exit.',
      'Database connections, queues, and caches are closed cleanly. Timeout is SHUTDOWN_TIMEOUT_MS.',
    ].join('\n'),
    cursorRules: [
      'Graceful shutdown is enabled via app.enableShutdownHooks(). Implement OnModuleDestroy for cleanup.',
      'Close connections in onModuleDestroy(). SHUTDOWN_TIMEOUT_MS sets the maximum wait time.',
    ].join('\n'),
    copilotInstructions: [
      'Graceful shutdown hooks handle SIGTERM/SIGINT. Implement OnModuleDestroy for resource cleanup.',
      'In-flight requests finish before shutdown. Timeout prevents hanging on unresponsive deps.',
    ].join('\n'),
  },
  {
    id: 'circuit-breaker',
    name: 'Circuit Breaker',
    description: 'Circuit breaker pattern for external service calls',
    category: 'Operational',
    dependencies: {
      opossum: '9.0.0',
    },
    devDependencies: {
      '@types/opossum': '8.1.7',
    },
    envVars: [
      {
        key: 'CIRCUIT_BREAKER_TIMEOUT',
        defaultValue: '3000',
        description: 'Circuit breaker call timeout in ms',
      },
      {
        key: 'CIRCUIT_BREAKER_THRESHOLD',
        defaultValue: '50',
        description: 'Failure percentage to open circuit',
      },
      {
        key: 'CIRCUIT_BREAKER_RESET_TIMEOUT',
        defaultValue: '30000',
        description: 'Time before half-open retry in ms',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'circuit-breaker',
    claudeMdSection: [
      '## Circuit Breaker',
      'Wrap external service calls with CircuitBreakerService to prevent cascade failures.',
      'Circuit opens after CIRCUIT_BREAKER_THRESHOLD% failures. Retries after CIRCUIT_BREAKER_RESET_TIMEOUT.',
    ].join('\n'),
    cursorRules: [
      'Use CircuitBreakerService for all external HTTP/API calls. Configure thresholds per dependency.',
      'Provide fallback functions for graceful degradation when the circuit is open.',
    ].join('\n'),
    copilotInstructions: [
      'Circuit breaker via opossum protects external calls. Use CircuitBreakerService wrapper.',
      'Configure timeout, threshold, and reset per external dependency. Provide fallbacks.',
    ].join('\n'),
  },
  {
    id: 'feature-flags',
    name: 'Feature Flags',
    description: 'Config-based feature flag system',
    category: 'Operational',
    dependencies: {},
    devDependencies: {},
    envVars: [
      {
        key: 'FEATURE_FLAGS',
        defaultValue: '{}',
        description: 'JSON object of feature flag key-value pairs',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'feature-flags',
    claudeMdSection: [
      '## Feature Flags',
      'Use FeatureFlagService.isEnabled("flag-name") to check flags. Flags are config-based.',
      'Set flags via FEATURE_FLAGS env var (JSON) or extend to use a remote provider.',
    ].join('\n'),
    cursorRules: [
      'Check flags via FeatureFlagService.isEnabled(). Define new flags in the FEATURE_FLAGS config.',
      'Use @FeatureGuard("flag") on routes to gate entire endpoints behind a feature flag.',
    ].join('\n'),
    copilotInstructions: [
      'Feature flags via FeatureFlagService. Check with isEnabled("flag").',
      'Configure via FEATURE_FLAGS env var (JSON). Use @FeatureGuard() for route-level gating.',
    ].join('\n'),
  },
  {
    id: 'multi-tenancy',
    name: 'Multi-Tenancy',
    description: 'Tenant isolation via AsyncLocalStorage and middleware',
    category: 'Operational',
    dependencies: {},
    devDependencies: {},
    envVars: [
      {
        key: 'TENANT_HEADER',
        defaultValue: 'x-tenant-id',
        description: 'Header name for tenant identification',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'multi-tenancy',
    claudeMdSection: [
      '## Multi-Tenancy',
      'Tenant ID is extracted from the x-tenant-id header and stored in AsyncLocalStorage.',
      'Access via TenantService.getTenantId(). All queries are automatically scoped to the tenant.',
    ].join('\n'),
    cursorRules: [
      'Tenant context is set via middleware and stored in AsyncLocalStorage. Use TenantService.',
      'All database queries must be tenant-scoped. Use tenant-aware base repository or interceptor.',
    ].join('\n'),
    copilotInstructions: [
      'Multi-tenancy uses AsyncLocalStorage for tenant context. Middleware extracts from header.',
      'Use TenantService.getTenantId() anywhere. Ensure all queries are tenant-scoped.',
    ].join('\n'),
  },

  // ─── Repo Hygiene ───────────────────────────────────────────────────
  {
    id: 'changelog',
    name: 'Changelog',
    description: 'Auto-generated changelog from conventional commits',
    category: 'Repo Hygiene',
    dependencies: {},
    devDependencies: {
      'conventional-changelog-cli': '5.0.0',
    },
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'changelog',
    claudeMdSection: [
      '## Changelog',
      'Run `pnpm changelog` to generate CHANGELOG.md from conventional commits.',
      'The changelog is auto-generated — do not edit manually.',
    ].join('\n'),
    cursorRules: [
      'CHANGELOG.md is auto-generated from conventional commits. Never edit it manually.',
      'Run `pnpm changelog` before releases. Follows Keep a Changelog format.',
    ].join('\n'),
    copilotInstructions: [
      'Changelog is generated from conventional commits via `pnpm changelog`.',
      'Do not manually edit CHANGELOG.md. Use conventional commit messages for proper entries.',
    ].join('\n'),
  },
  {
    id: 'license',
    name: 'License',
    description: 'License file template',
    category: 'Repo Hygiene',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'license',
    claudeMdSection: [
      '## License',
      'See LICENSE file in the project root for licensing terms.',
    ].join('\n'),
    cursorRules: ['License file is in the project root. Update copyright year as needed.'].join(
      '\n',
    ),
    copilotInstructions: ['Project license is in the LICENSE file at the project root.'].join('\n'),
  },
  {
    id: 'env-per-environment',
    name: 'Environment Files',
    description: 'Per-environment .env file templates',
    category: 'Repo Hygiene',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'env-per-environment',
    claudeMdSection: [
      '## Environment Files',
      'Environment templates: `.env.development`, `.env.staging`, `.env.production`.',
      'Copy to `.env` for local use. Never commit `.env` — only `.env.example` and templates.',
    ].join('\n'),
    cursorRules: [
      'Use .env.development/.env.staging/.env.production templates. Copy to .env locally.',
      'Never commit .env files with real secrets. Only .env.example is committed.',
    ].join('\n'),
    copilotInstructions: [
      'Per-environment .env templates are provided. Copy the appropriate one to .env locally.',
      '.env is gitignored. Only .env.example and environment templates are committed.',
    ].join('\n'),
  },
  {
    id: 'dependabot-renovate',
    name: 'Dependabot / Renovate',
    description: 'Automated dependency update configuration',
    category: 'Repo Hygiene',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'dependabot-renovate',
    claudeMdSection: [
      '## Dependabot / Renovate',
      'Automated dependency update PRs are configured. Review and merge promptly.',
      'Config is in `.github/dependabot.yml` or `renovate.json`.',
    ].join('\n'),
    cursorRules: [
      'Dependency update config is in .github/dependabot.yml or renovate.json.',
      'Review auto-generated PRs for breaking changes before merging.',
    ].join('\n'),
    copilotInstructions: [
      'Dependabot/Renovate is configured for automated dependency updates.',
      'Review generated PRs carefully, especially for major version bumps.',
    ].join('\n'),
  },

  // ─── Docs Site ──────────────────────────────────────────────────────
  {
    id: 'docs-site',
    name: 'Documentation Site',
    description: 'VitePress-powered documentation site',
    category: 'Docs Site',
    dependencies: {},
    devDependencies: {
      vitepress: '1.5.0',
    },
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'docs-site',
    claudeMdSection: [
      '## Documentation Site',
      'Run `pnpm docs:dev` to start the VitePress dev server. Docs are in `docs/`.',
      'Build for production with `pnpm docs:build`. Output goes to `docs/.vitepress/dist/`.',
    ].join('\n'),
    cursorRules: [
      'Documentation lives in docs/ using VitePress. Markdown files map to routes.',
      'Run `pnpm docs:dev` for local preview. Config is in docs/.vitepress/config.ts.',
    ].join('\n'),
    copilotInstructions: [
      'VitePress documentation in docs/. Run `pnpm docs:dev` for development.',
      'Build with `pnpm docs:build`. Configure navigation in docs/.vitepress/config.ts.',
    ].join('\n'),
  },
  // ─── AWS ──────────────────────────────────────────────────────────
  {
    id: 'aws-sqs',
    name: 'AWS SQS',
    description: 'Amazon Simple Queue Service integration for message queuing',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-sqs': '3.712.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      { key: 'SQS_QUEUE_URL', defaultValue: '', description: 'SQS queue URL' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/sqs',
    claudeMdSection: [
      '## AWS SQS',
      'Use SqsService to send and receive messages. Configure queue URL via SQS_QUEUE_URL.',
      'Use long polling for efficient message retrieval. Handle message visibility timeouts.',
    ].join('\n'),
    cursorRules: [
      'Use SqsService for all SQS operations. Never hardcode queue URLs — use ConfigService.',
      'Handle message deletion after successful processing. Use dead-letter queues for failures.',
    ].join('\n'),
    copilotInstructions: [
      'AWS SQS via @aws-sdk/client-sqs. Use SqsService for sending and receiving messages.',
      'Configure SQS_QUEUE_URL in env. Use long polling and dead-letter queues.',
    ].join('\n'),
  },
  {
    id: 'aws-sns',
    name: 'AWS SNS',
    description: 'Amazon Simple Notification Service for pub/sub messaging',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-sns': '3.712.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      { key: 'SNS_TOPIC_ARN', defaultValue: '', description: 'SNS topic ARN' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/sns',
    claudeMdSection: [
      '## AWS SNS',
      'Use SnsService to publish messages to topics. Configure topic ARN via SNS_TOPIC_ARN.',
      'Subscribe SQS queues, Lambda functions, or HTTP endpoints to SNS topics.',
    ].join('\n'),
    cursorRules: [
      'Use SnsService for publishing. Never hardcode topic ARNs — use ConfigService.',
      'Use message attributes for filtering. Fan-out patterns pair SNS with SQS subscriptions.',
    ].join('\n'),
    copilotInstructions: [
      'AWS SNS via @aws-sdk/client-sns. Publish with SnsService.',
      'Topic ARN from env. Use message attributes for subscriber filtering.',
    ].join('\n'),
  },
  {
    id: 'aws-eventbridge',
    name: 'AWS EventBridge',
    description: 'Amazon EventBridge for event-driven architectures',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-eventbridge': '3.712.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      { key: 'EVENTBRIDGE_BUS_NAME', defaultValue: 'default', description: 'EventBridge bus name' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/eventbridge',
    claudeMdSection: [
      '## AWS EventBridge',
      'Use EventBridgeService to put events on the bus. Configure bus name via EVENTBRIDGE_BUS_NAME.',
      'Define event patterns and rules in infrastructure-as-code, not application code.',
    ].join('\n'),
    cursorRules: [
      'Use EventBridgeService to publish domain events. Define detail-type and source consistently.',
      'Event rules and targets belong in IaC (Terraform/CDK), not in application code.',
    ].join('\n'),
    copilotInstructions: [
      'AWS EventBridge via @aws-sdk/client-eventbridge. Use EventBridgeService for events.',
      'Set EVENTBRIDGE_BUS_NAME in env. Keep event schemas consistent across services.',
    ].join('\n'),
  },
  {
    id: 'aws-secrets-manager',
    name: 'AWS Secrets Manager',
    description: 'Retrieve and cache secrets from AWS Secrets Manager',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-secrets-manager': '3.712.0',
    },
    devDependencies: {},
    envVars: [{ key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' }],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/secrets-manager',
    claudeMdSection: [
      '## AWS Secrets Manager',
      'Use SecretsService to fetch secrets at startup. Secrets are cached to reduce API calls.',
      'Rotate secrets via AWS console or CLI — the app reads the latest version automatically.',
    ].join('\n'),
    cursorRules: [
      'Use SecretsService to load secrets. Cache secrets in memory and refresh on a schedule.',
      'Never store secret values in env files for production — use Secrets Manager exclusively.',
    ].join('\n'),
    copilotInstructions: [
      'AWS Secrets Manager via @aws-sdk/client-secrets-manager. Use SecretsService wrapper.',
      'Secrets are cached locally. Rotation is handled by AWS — app reads latest version.',
    ].join('\n'),
  },
  {
    id: 'aws-ssm',
    name: 'AWS SSM Parameter Store',
    description: 'Retrieve configuration from AWS Systems Manager Parameter Store',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-ssm': '3.712.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      { key: 'SSM_PREFIX', defaultValue: '/app/prod', description: 'SSM parameter path prefix' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/ssm',
    claudeMdSection: [
      '## AWS SSM Parameter Store',
      'Use SsmService to load parameters by path prefix at bootstrap.',
      'Parameters are cached and refreshed periodically. Use SecureString type for sensitive values.',
    ].join('\n'),
    cursorRules: [
      'Use SsmService to load configuration. Organize parameters under a path prefix per environment.',
      'Use SecureString for sensitive values. Cache parameters and refresh on a configurable interval.',
    ].join('\n'),
    copilotInstructions: [
      'AWS SSM Parameter Store via @aws-sdk/client-ssm. Use SsmService for config values.',
      'Set SSM_PREFIX per environment. SecureString for secrets, String for plain config.',
    ].join('\n'),
  },
  {
    id: 'aws-s3',
    name: 'AWS S3',
    description: 'Amazon S3 object storage for file uploads and downloads',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-s3': '3.712.0',
      '@aws-sdk/s3-request-presigner': '3.712.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      { key: 'S3_BUCKET', defaultValue: 'my-bucket', description: 'S3 bucket name' },
    ],
    conflicts: ['s3-minio'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/s3',
    claudeMdSection: [
      '## AWS S3',
      'Use S3Service for uploads, downloads, and presigned URLs.',
      'Configure bucket name via S3_BUCKET. Use presigned URLs for client-side uploads.',
    ].join('\n'),
    cursorRules: [
      'Use S3Service abstraction for all S3 operations. Never expose AWS credentials to clients.',
      'Generate presigned URLs for direct browser uploads. Set appropriate content-type and size limits.',
    ].join('\n'),
    copilotInstructions: [
      'AWS S3 via @aws-sdk/client-s3. Use S3Service for file operations.',
      'Presigned URLs for client uploads. Bucket name from S3_BUCKET env var.',
    ].join('\n'),
  },
  {
    id: 'aws-cognito',
    name: 'AWS Cognito',
    description: 'AWS Cognito user pool authentication and authorization',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-cognito-identity-provider': '3.712.0',
      'aws-jwt-verify': '4.0.1',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      { key: 'COGNITO_USER_POOL_ID', defaultValue: '', description: 'Cognito user pool ID' },
      { key: 'COGNITO_CLIENT_ID', defaultValue: '', description: 'Cognito app client ID' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/cognito',
    claudeMdSection: [
      '## AWS Cognito',
      'Use CognitoAuthGuard to validate Cognito JWT tokens on protected routes.',
      'Configure user pool ID and client ID via environment variables.',
    ].join('\n'),
    cursorRules: [
      'Use CognitoAuthGuard for authentication. Validate JWTs against the Cognito JWKS endpoint.',
      'Configure COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID from env. Use groups for RBAC.',
    ].join('\n'),
    copilotInstructions: [
      'AWS Cognito authenticates users via JWT. Apply CognitoAuthGuard to protected routes.',
      'User pool and client IDs from env. Token validation uses Cognito JWKS endpoint.',
    ].join('\n'),
  },
  {
    id: 'aws-cloudwatch',
    name: 'AWS CloudWatch Logs',
    description: 'Ship application logs to AWS CloudWatch Logs',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-cloudwatch-logs': '3.712.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      {
        key: 'CLOUDWATCH_LOG_GROUP',
        defaultValue: '/app/nestjs',
        description: 'CloudWatch log group name',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/cloudwatch',
    claudeMdSection: [
      '## AWS CloudWatch Logs',
      'Application logs are shipped to CloudWatch Logs. Configure log group via CLOUDWATCH_LOG_GROUP.',
      'Use structured JSON logging for CloudWatch Insights queries.',
    ].join('\n'),
    cursorRules: [
      'Logs are sent to CloudWatch. Use structured JSON for queryability in CloudWatch Insights.',
      'Configure CLOUDWATCH_LOG_GROUP from env. Use log streams per instance or container.',
    ].join('\n'),
    copilotInstructions: [
      'AWS CloudWatch Logs via @aws-sdk/client-cloudwatch-logs. Structured JSON logs.',
      'Log group from CLOUDWATCH_LOG_GROUP env. Use Insights for querying.',
    ].join('\n'),
  },
  {
    id: 'aws-rds',
    name: 'AWS RDS',
    description: 'AWS RDS connection with IAM authentication support',
    category: 'Cloud — AWS',
    dependencies: {
      '@nestjs/typeorm': '10.0.2',
      typeorm: '0.3.20',
      pg: '8.13.1',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      { key: 'RDS_HOST', defaultValue: '', description: 'RDS instance endpoint' },
      { key: 'RDS_PORT', defaultValue: '5432', description: 'RDS port' },
      { key: 'RDS_DATABASE', defaultValue: 'app', description: 'RDS database name' },
      { key: 'RDS_USERNAME', defaultValue: 'postgres', description: 'RDS username' },
      { key: 'RDS_PASSWORD', defaultValue: '', description: 'RDS password' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/rds',
    claudeMdSection: [
      '## AWS RDS',
      'TypeORM connects to RDS PostgreSQL. Use IAM authentication in production for passwordless access.',
      'Configure RDS endpoint and credentials via environment variables.',
    ].join('\n'),
    cursorRules: [
      'RDS connection uses TypeORM. Use IAM database authentication in production environments.',
      'Enable SSL for RDS connections. Use RDS Proxy for connection pooling in serverless setups.',
    ].join('\n'),
    copilotInstructions: [
      'AWS RDS with TypeORM. Connection details from RDS_HOST, RDS_PORT, RDS_DATABASE env vars.',
      'Use IAM auth in production. Enable SSL and consider RDS Proxy for Lambda.',
    ].join('\n'),
  },
  {
    id: 'aws-dynamodb',
    name: 'AWS DynamoDB',
    description: 'Amazon DynamoDB NoSQL database integration',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-dynamodb': '3.712.0',
      '@aws-sdk/lib-dynamodb': '3.712.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'AWS_REGION', defaultValue: 'eu-west-1', description: 'AWS region' },
      { key: 'DYNAMODB_TABLE_NAME', defaultValue: 'app-table', description: 'DynamoDB table name' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/dynamodb',
    claudeMdSection: [
      '## AWS DynamoDB',
      'Use DynamoDbService for CRUD operations. Table name is configured via DYNAMODB_TABLE_NAME.',
      'Use the Document Client (lib-dynamodb) for simplified marshalling of JavaScript objects.',
    ].join('\n'),
    cursorRules: [
      'Use DynamoDbService with lib-dynamodb Document Client. Design single-table patterns carefully.',
      'Use partition and sort keys effectively. Prefer Query over Scan for performance.',
    ].join('\n'),
    copilotInstructions: [
      'AWS DynamoDB via @aws-sdk/client-dynamodb and lib-dynamodb. Use DynamoDbService wrapper.',
      'Table from DYNAMODB_TABLE_NAME env. Use Query over Scan. Design access patterns first.',
    ].join('\n'),
  },
  {
    id: 'aws-elasticache',
    name: 'AWS ElastiCache',
    description: 'AWS ElastiCache (Redis) for managed caching',
    category: 'Cloud — AWS',
    dependencies: {
      ioredis: '5.4.2',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'ELASTICACHE_ENDPOINT',
        defaultValue: '',
        description: 'ElastiCache primary endpoint',
      },
      { key: 'ELASTICACHE_PORT', defaultValue: '6379', description: 'ElastiCache port' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/elasticache',
    claudeMdSection: [
      '## AWS ElastiCache',
      'ElastiCache Redis is used for caching. Connect via ELASTICACHE_ENDPOINT.',
      'Enable TLS for in-transit encryption. Use Redis cluster mode for high availability.',
    ].join('\n'),
    cursorRules: [
      'Connect to ElastiCache via ioredis. Enable TLS in production.',
      'Use ELASTICACHE_ENDPOINT from env. Design cache keys with clear namespacing.',
    ].join('\n'),
    copilotInstructions: [
      'AWS ElastiCache (Redis) via ioredis. Endpoint from ELASTICACHE_ENDPOINT env.',
      'Enable TLS for production. Use cluster mode for HA. Namespace cache keys.',
    ].join('\n'),
  },
  {
    id: 'aws-cloudfront',
    name: 'AWS CloudFront',
    description: 'AWS CloudFront CDN integration with signed URLs',
    category: 'Cloud — AWS',
    dependencies: {
      '@aws-sdk/client-cloudfront': '3.712.0',
      '@aws-sdk/cloudfront-signer': '3.723.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'CLOUDFRONT_KEY_PAIR_ID',
        defaultValue: '',
        description: 'CloudFront key pair ID for signed URLs',
      },
      {
        key: 'CLOUDFRONT_PRIVATE_KEY',
        defaultValue: '',
        description: 'CloudFront private key for signed URLs',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-aws/cloudfront',
    claudeMdSection: [
      '## AWS CloudFront',
      'Use CloudFrontService to generate signed URLs and invalidate caches.',
      'Configure distribution domain and key pair ID for signed URL generation.',
    ].join('\n'),
    cursorRules: [
      'Use CloudFrontService for signed URLs and cache invalidation. Never expose signing keys.',
      'Set CLOUDFRONT_DOMAIN and CLOUDFRONT_KEY_PAIR_ID from env. Use signed URLs for private content.',
    ].join('\n'),
    copilotInstructions: [
      'AWS CloudFront via @aws-sdk/client-cloudfront. Use CloudFrontService for signed URLs.',
      'Distribution config from env. Use cache invalidation sparingly — prefer versioned paths.',
    ].join('\n'),
  },

  // ─── GCP ──────────────────────────────────────────────────────────
  {
    id: 'gcp-pubsub',
    name: 'GCP Pub/Sub',
    description: 'Google Cloud Pub/Sub messaging integration',
    category: 'Cloud — GCP',
    dependencies: {
      '@google-cloud/pubsub': '4.9.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP project ID' },
      { key: 'PUBSUB_TOPIC', defaultValue: '', description: 'Pub/Sub topic name' },
      { key: 'PUBSUB_SUBSCRIPTION', defaultValue: '', description: 'Pub/Sub subscription name' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/pubsub',
    claudeMdSection: [
      '## GCP Pub/Sub',
      'Use PubSubService to publish and subscribe to messages. Configure topic and subscription via env.',
      'Use ordering keys for ordered delivery. Enable dead-letter topics for failed messages.',
    ].join('\n'),
    cursorRules: [
      'Use PubSubService for publish/subscribe. Configure GCP_PROJECT_ID and topic names from env.',
      'Acknowledge messages after processing. Use dead-letter topics for poison messages.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Pub/Sub via @google-cloud/pubsub. Use PubSubService for messaging.',
      'Set GCP_PROJECT_ID and PUBSUB_TOPIC in env. Ack messages after successful processing.',
    ].join('\n'),
  },
  {
    id: 'gcp-secret-manager',
    name: 'GCP Secret Manager',
    description: 'Google Cloud Secret Manager for secret storage',
    category: 'Cloud — GCP',
    dependencies: {
      '@google-cloud/secret-manager': '5.6.0',
    },
    devDependencies: {},
    envVars: [{ key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP project ID' }],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/secret-manager',
    claudeMdSection: [
      '## GCP Secret Manager',
      'Use GcpSecretsService to fetch secrets at startup. Secrets are cached to reduce API calls.',
      'Secret versions are managed in GCP console. The app reads the latest version by default.',
    ].join('\n'),
    cursorRules: [
      'Use GcpSecretsService for secrets. Cache values and refresh periodically.',
      'Never store production secrets in env files — use Secret Manager exclusively.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Secret Manager via @google-cloud/secret-manager. Use GcpSecretsService wrapper.',
      'Set GCP_PROJECT_ID in env. Secrets cached locally with periodic refresh.',
    ].join('\n'),
  },
  {
    id: 'gcp-cloud-storage',
    name: 'GCP Cloud Storage',
    description: 'Google Cloud Storage for object storage',
    category: 'Cloud — GCP',
    dependencies: {
      '@google-cloud/storage': '7.14.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP project ID' },
      { key: 'GCS_BUCKET', defaultValue: '', description: 'Cloud Storage bucket name' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/cloud-storage',
    claudeMdSection: [
      '## GCP Cloud Storage',
      'Use GcsStorageService for file uploads, downloads, and signed URLs.',
      'Configure bucket name via GCS_BUCKET. Use signed URLs for client-side uploads.',
    ].join('\n'),
    cursorRules: [
      'Use GcsStorageService for all Cloud Storage operations. Never expose service account keys to clients.',
      'Use signed URLs for direct browser uploads. Set appropriate content-type and size limits.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Cloud Storage via @google-cloud/storage. Use GcsStorageService for file operations.',
      'Bucket name from GCS_BUCKET env. Use signed URLs for client uploads.',
    ].join('\n'),
  },
  {
    id: 'gcp-cloud-functions',
    name: 'GCP Cloud Functions',
    description: 'Google Cloud Functions integration for serverless workloads',
    category: 'Cloud — GCP',
    dependencies: {
      '@google-cloud/functions-framework': '3.4.5',
    },
    devDependencies: {},
    envVars: [
      { key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP project ID' },
      {
        key: 'FUNCTION_TARGET',
        defaultValue: 'handler',
        description: 'Cloud Function entry point',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/cloud-functions',
    claudeMdSection: [
      '## GCP Cloud Functions',
      'The NestJS app is wrapped for Cloud Functions via the functions-framework.',
      'Set FUNCTION_TARGET to the exported handler function name.',
    ].join('\n'),
    cursorRules: [
      'Cloud Functions entry point wraps the NestJS app. Keep cold start time minimal.',
      'Use lazy initialization for heavy dependencies. Set FUNCTION_TARGET in deployment config.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Cloud Functions via @google-cloud/functions-framework. NestJS wrapped as function.',
      'Optimize for cold starts. FUNCTION_TARGET env sets the entry point.',
    ].join('\n'),
  },
  {
    id: 'gcp-firebase-auth',
    name: 'GCP Firebase Auth',
    description: 'Firebase Authentication for user identity management',
    category: 'Cloud — GCP',
    dependencies: {
      'firebase-admin': '13.0.2',
    },
    devDependencies: {},
    envVars: [
      { key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP/Firebase project ID' },
      {
        key: 'GOOGLE_APPLICATION_CREDENTIALS',
        defaultValue: '',
        description: 'Path to service account key JSON',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/firebase-auth',
    claudeMdSection: [
      '## GCP Firebase Auth',
      'Use FirebaseAuthGuard to validate Firebase ID tokens on protected routes.',
      'Initialize firebase-admin with application default credentials or a service account key.',
    ].join('\n'),
    cursorRules: [
      'Use FirebaseAuthGuard for authentication. Validate ID tokens via firebase-admin verifyIdToken.',
      'Initialize admin SDK once in a module provider. Use application default credentials in GCP.',
    ].join('\n'),
    copilotInstructions: [
      'Firebase Auth via firebase-admin. Apply FirebaseAuthGuard to protected routes.',
      'Token validation uses admin.auth().verifyIdToken(). Set GOOGLE_APPLICATION_CREDENTIALS.',
    ].join('\n'),
  },
  {
    id: 'gcp-cloud-logging',
    name: 'GCP Cloud Logging',
    description: 'Google Cloud Logging (Stackdriver) integration',
    category: 'Cloud — GCP',
    dependencies: {
      '@google-cloud/logging': '11.2.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP project ID' },
      { key: 'GCP_LOG_NAME', defaultValue: 'nestjs-app', description: 'Cloud Logging log name' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/cloud-logging',
    claudeMdSection: [
      '## GCP Cloud Logging',
      'Application logs are shipped to Cloud Logging. Configure log name via GCP_LOG_NAME.',
      'Use structured JSON for Cloud Logging query compatibility.',
    ].join('\n'),
    cursorRules: [
      'Logs are sent to Cloud Logging. Use structured JSON for queryability in Logs Explorer.',
      'Configure GCP_LOG_NAME from env. Include severity levels compatible with Cloud Logging.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Cloud Logging via @google-cloud/logging. Structured JSON logs.',
      'Log name from GCP_LOG_NAME env. Use severity levels matching Cloud Logging.',
    ].join('\n'),
  },
  {
    id: 'gcp-cloud-sql',
    name: 'GCP Cloud SQL',
    description: 'Google Cloud SQL managed database connection',
    category: 'Cloud — GCP',
    dependencies: {
      '@nestjs/typeorm': '10.0.2',
      typeorm: '0.3.20',
      pg: '8.13.1',
    },
    devDependencies: {},
    envVars: [
      { key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP project ID' },
      {
        key: 'CLOUD_SQL_CONNECTION_NAME',
        defaultValue: '',
        description: 'Cloud SQL instance connection name',
      },
      { key: 'DB_NAME', defaultValue: 'app', description: 'Database name' },
      { key: 'DB_USERNAME', defaultValue: 'postgres', description: 'Database username' },
      { key: 'DB_PASSWORD', defaultValue: '', description: 'Database password' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/cloud-sql',
    claudeMdSection: [
      '## GCP Cloud SQL',
      'TypeORM connects to Cloud SQL PostgreSQL. Use Cloud SQL Auth Proxy for local development.',
      'Configure instance connection name and credentials via environment variables.',
    ].join('\n'),
    cursorRules: [
      'Cloud SQL uses TypeORM. Use Cloud SQL Auth Proxy for secure local connections.',
      'Enable IAM database authentication in production. Use private IP for VPC access.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Cloud SQL with TypeORM. Connection name from CLOUD_SQL_CONNECTION_NAME env.',
      'Use Cloud SQL Auth Proxy locally. IAM auth and private IP in production.',
    ].join('\n'),
  },
  {
    id: 'gcp-firestore',
    name: 'GCP Firestore',
    description: 'Google Cloud Firestore NoSQL document database',
    category: 'Cloud — GCP',
    dependencies: {
      '@google-cloud/firestore': '7.11.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP project ID' },
      {
        key: 'FIRESTORE_DATABASE_ID',
        defaultValue: '(default)',
        description: 'Firestore database ID',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/firestore',
    claudeMdSection: [
      '## GCP Firestore',
      'Use FirestoreService for document CRUD operations. Configure database ID via FIRESTORE_DATABASE_ID.',
      'Use collection references and document snapshots for type-safe access.',
    ].join('\n'),
    cursorRules: [
      'Use FirestoreService wrapper for all Firestore operations. Design collection structures carefully.',
      'Use batched writes for multiple operations. Prefer queries with indexes over full scans.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Firestore via @google-cloud/firestore. Use FirestoreService wrapper.',
      'Set GCP_PROJECT_ID in env. Use indexed queries and batched writes.',
    ].join('\n'),
  },
  {
    id: 'gcp-memorystore',
    name: 'GCP Memorystore',
    description: 'Google Cloud Memorystore (Redis) for managed caching',
    category: 'Cloud — GCP',
    dependencies: {
      ioredis: '5.4.2',
    },
    devDependencies: {},
    envVars: [
      { key: 'MEMORYSTORE_HOST', defaultValue: '', description: 'Memorystore Redis host' },
      { key: 'MEMORYSTORE_PORT', defaultValue: '6379', description: 'Memorystore Redis port' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/memorystore',
    claudeMdSection: [
      '## GCP Memorystore',
      'Memorystore Redis is used for caching. Connect via MEMORYSTORE_HOST.',
      'Enable AUTH and in-transit encryption for production. Use VPC peering for access.',
    ].join('\n'),
    cursorRules: [
      'Connect to Memorystore via ioredis. Enable AUTH and TLS in production.',
      'Use MEMORYSTORE_HOST from env. Design cache keys with clear namespacing.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Memorystore (Redis) via ioredis. Host from MEMORYSTORE_HOST env.',
      'Enable AUTH and TLS for production. VPC peering required for connectivity.',
    ].join('\n'),
  },
  {
    id: 'gcp-cloud-cdn',
    name: 'GCP Cloud CDN',
    description: 'Google Cloud CDN for content delivery',
    category: 'Cloud — GCP',
    dependencies: {},
    devDependencies: {},
    envVars: [
      { key: 'GCP_PROJECT_ID', defaultValue: '', description: 'GCP project ID' },
      { key: 'CDN_SIGNING_KEY_NAME', defaultValue: '', description: 'Cloud CDN signing key name' },
      { key: 'CDN_SIGNING_KEY', defaultValue: '', description: 'Cloud CDN signing key (base64)' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-gcp/cloud-cdn',
    claudeMdSection: [
      '## GCP Cloud CDN',
      'Use CdnService to generate signed URLs for private content.',
      'Configure signing key name and key value via environment variables.',
    ].join('\n'),
    cursorRules: [
      'Use CdnService for signed URL generation. Never expose signing keys to clients.',
      'Set CDN_SIGNING_KEY_NAME and CDN_SIGNING_KEY from env. Use signed URLs for private assets.',
    ].join('\n'),
    copilotInstructions: [
      'GCP Cloud CDN signed URLs via CdnService. Signing key config from env.',
      'CDN is configured at infrastructure level. App generates signed URLs for access control.',
    ].join('\n'),
  },

  // ─── Azure ────────────────────────────────────────────────────────
  {
    id: 'azure-service-bus',
    name: 'Azure Service Bus',
    description: 'Azure Service Bus for enterprise messaging',
    category: 'Cloud — Azure',
    dependencies: {
      '@azure/service-bus': '7.9.5',
      '@azure/identity': '4.5.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'AZURE_SERVICE_BUS_CONNECTION_STRING',
        defaultValue: '',
        description: 'Service Bus connection string',
      },
      { key: 'AZURE_SERVICEBUS_QUEUE', defaultValue: '', description: 'Service Bus queue name' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/service-bus',
    claudeMdSection: [
      '## Azure Service Bus',
      'Use ServiceBusService to send and receive messages. Configure connection string via env.',
      'Use sessions for ordered processing. Dead-letter queues handle poison messages.',
    ].join('\n'),
    cursorRules: [
      'Use ServiceBusService for messaging. Connection string from AZURE_SERVICE_BUS_CONNECTION_STRING.',
      'Complete messages after processing. Use sessions for FIFO. Configure dead-letter queues.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Service Bus via @azure/service-bus. Use ServiceBusService wrapper.',
      'Connection string from env. Complete messages after processing. Use dead-letter for failures.',
    ].join('\n'),
  },
  {
    id: 'azure-key-vault',
    name: 'Azure Key Vault',
    description: 'Azure Key Vault for secret and key management',
    category: 'Cloud — Azure',
    dependencies: {
      '@azure/keyvault-secrets': '4.9.0',
      '@azure/identity': '4.5.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'AZURE_KEY_VAULT_URL',
        defaultValue: '',
        description: 'Key Vault URL (https://<name>.vault.azure.net)',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/key-vault',
    claudeMdSection: [
      '## Azure Key Vault',
      'Use KeyVaultService to fetch secrets at startup. Secrets are cached to reduce API calls.',
      'Authenticate via DefaultAzureCredential for managed identity support.',
    ].join('\n'),
    cursorRules: [
      'Use KeyVaultService for secrets. Authenticate with DefaultAzureCredential.',
      'Cache secrets locally. Set AZURE_KEY_VAULT_URL from env. Use managed identities in production.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Key Vault via @azure/keyvault-secrets. Use KeyVaultService wrapper.',
      'AZURE_KEY_VAULT_URL from env. DefaultAzureCredential for authentication.',
    ].join('\n'),
  },
  {
    id: 'azure-blob-storage',
    name: 'Azure Blob Storage',
    description: 'Azure Blob Storage for object storage',
    category: 'Cloud — Azure',
    dependencies: {
      '@azure/storage-blob': '12.26.0',
      '@azure/identity': '4.5.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'AZURE_STORAGE_ACCOUNT_NAME',
        defaultValue: '',
        description: 'Azure Storage account name',
      },
      {
        key: 'AZURE_STORAGE_ACCOUNT_KEY',
        defaultValue: '',
        description: 'Azure Storage account key',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/blob-storage',
    claudeMdSection: [
      '## Azure Blob Storage',
      'Use BlobStorageService for uploads, downloads, and SAS URL generation.',
      'Configure account name and key via environment variables.',
    ].join('\n'),
    cursorRules: [
      'Use BlobStorageService for all blob operations. Generate SAS URLs for client uploads.',
      'Account name and key from env. Use managed identity (DefaultAzureCredential) in production.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Blob Storage via @azure/storage-blob. Use BlobStorageService wrapper.',
      'Account name and key from env. SAS URLs for client-side uploads. Managed identity in prod.',
    ].join('\n'),
  },
  {
    id: 'azure-functions',
    name: 'Azure Functions',
    description: 'Azure Functions integration for serverless workloads',
    category: 'Cloud — Azure',
    dependencies: {
      '@azure/functions': '4.6.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'AZURE_FUNCTIONS_ENVIRONMENT',
        defaultValue: 'Development',
        description: 'Azure Functions environment',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/functions',
    claudeMdSection: [
      '## Azure Functions',
      'The NestJS app is adapted for Azure Functions via the @azure/functions runtime.',
      'Configure triggers and bindings in the function definition files.',
    ].join('\n'),
    cursorRules: [
      'Azure Functions entry point wraps the NestJS app. Keep cold start time minimal.',
      'Use lazy initialization for heavy dependencies. Configure bindings declaratively.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Functions via @azure/functions. NestJS wrapped as function handler.',
      'Optimize for cold starts. Use bindings for triggers (HTTP, timer, queue).',
    ].join('\n'),
  },
  {
    id: 'azure-entra-id',
    name: 'Azure Entra ID',
    description: 'Azure Entra ID (formerly Azure AD) authentication',
    category: 'Cloud — Azure',
    dependencies: {
      '@azure/msal-node': '2.16.2',
      '@azure/identity': '4.5.0',
      jsonwebtoken: '9.0.3',
      'jwks-rsa': '4.0.1',
    },
    devDependencies: {
      '@types/jsonwebtoken': '9.0.10',
    },
    envVars: [
      { key: 'AZURE_TENANT_ID', defaultValue: '', description: 'Azure Entra ID tenant ID' },
      {
        key: 'AZURE_CLIENT_ID',
        defaultValue: '',
        description: 'Azure Entra ID client (application) ID',
      },
      { key: 'AZURE_CLIENT_SECRET', defaultValue: '', description: 'Azure Entra ID client secret' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/entra-id',
    claudeMdSection: [
      '## Azure Entra ID',
      'Use EntraIdGuard to validate Entra ID JWT tokens on protected routes.',
      'Configure tenant ID, client ID, and client secret via environment variables.',
    ].join('\n'),
    cursorRules: [
      'Use EntraIdGuard for authentication. Validate JWT tokens against the Entra ID JWKS endpoint.',
      'Configure AZURE_TENANT_ID, AZURE_CLIENT_ID from env. Use app roles for RBAC.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Entra ID via @azure/msal-node. Apply EntraIdGuard to protected routes.',
      'Tenant and client IDs from env. Token validation uses Entra ID JWKS endpoint.',
    ].join('\n'),
  },
  {
    id: 'azure-app-insights',
    name: 'Azure Application Insights',
    description: 'Azure Application Insights for telemetry and monitoring',
    category: 'Cloud — Azure',
    dependencies: {
      applicationinsights: '3.4.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'APPLICATIONINSIGHTS_CONNECTION_STRING',
        defaultValue: '',
        description: 'Application Insights connection string',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/app-insights',
    claudeMdSection: [
      '## Azure Application Insights',
      'Application Insights collects telemetry, traces, and exceptions automatically.',
      'Configure via APPLICATIONINSIGHTS_CONNECTION_STRING. Custom events via TelemetryClient.',
    ].join('\n'),
    cursorRules: [
      'App Insights is initialized at startup. Unhandled exceptions are auto-captured.',
      'Use TelemetryClient for custom events and metrics. Connection string from env.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Application Insights via applicationinsights package. Auto-collects telemetry.',
      'Connection string from env. Use TelemetryClient for custom events and metrics.',
    ].join('\n'),
  },
  {
    id: 'azure-cosmos-db',
    name: 'Azure Cosmos DB',
    description: 'Azure Cosmos DB NoSQL database integration',
    category: 'Cloud — Azure',
    dependencies: {
      '@azure/cosmos': '4.2.0',
      '@azure/identity': '4.5.0',
    },
    devDependencies: {},
    envVars: [
      { key: 'AZURE_COSMOS_ENDPOINT', defaultValue: '', description: 'Cosmos DB account endpoint' },
      { key: 'AZURE_COSMOS_KEY', defaultValue: '', description: 'Cosmos DB account key' },
      {
        key: 'AZURE_COSMOS_DATABASE',
        defaultValue: 'app',
        description: 'Cosmos DB database name',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/cosmos-db',
    claudeMdSection: [
      '## Azure Cosmos DB',
      'Use CosmosDbService for container and item operations. Configure endpoint and key via env.',
      'Choose partition keys carefully for optimal performance and cost.',
    ].join('\n'),
    cursorRules: [
      'Use CosmosDbService for all Cosmos DB operations. Design partition keys for query patterns.',
      'Use cross-partition queries sparingly. Configure RU limits per container.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Cosmos DB via @azure/cosmos. Use CosmosDbService wrapper.',
      'Endpoint and key from env. Design partition keys for query access patterns.',
    ].join('\n'),
  },
  {
    id: 'azure-sql-database',
    name: 'Azure SQL Database',
    description: 'Azure SQL Database managed connection',
    category: 'Cloud — Azure',
    dependencies: {
      '@nestjs/typeorm': '10.0.2',
      typeorm: '0.3.20',
      mssql: '11.0.1',
    },
    devDependencies: {},
    envVars: [
      { key: 'AZURE_SQL_HOST', defaultValue: '', description: 'Azure SQL server hostname' },
      { key: 'AZURE_SQL_PORT', defaultValue: '1433', description: 'Azure SQL port' },
      { key: 'AZURE_SQL_DATABASE', defaultValue: 'app', description: 'Azure SQL database name' },
      { key: 'AZURE_SQL_USERNAME', defaultValue: '', description: 'Azure SQL username' },
      { key: 'AZURE_SQL_PASSWORD', defaultValue: '', description: 'Azure SQL password' },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/sql-database',
    claudeMdSection: [
      '## Azure SQL Database',
      'TypeORM connects to Azure SQL Database. Configure host and credentials via environment variables.',
      'Enable encryption and use managed identity authentication in production.',
    ].join('\n'),
    cursorRules: [
      'Azure SQL uses TypeORM with mssql driver. Enable encryption for all connections.',
      'Use Azure AD authentication (managed identity) in production. Connection details from env.',
    ].join('\n'),
    copilotInstructions: [
      'Azure SQL Database with TypeORM and mssql driver. Connection from AZURE_SQL_* env vars.',
      'Enable encryption. Use Azure AD managed identity auth in production.',
    ].join('\n'),
  },
  {
    id: 'azure-cache',
    name: 'Azure Cache for Redis',
    description: 'Azure Cache for Redis managed caching service',
    category: 'Cloud — Azure',
    dependencies: {
      ioredis: '5.4.2',
    },
    devDependencies: {},
    envVars: [
      { key: 'AZURE_REDIS_HOST', defaultValue: '', description: 'Azure Cache for Redis hostname' },
      { key: 'AZURE_REDIS_PORT', defaultValue: '6380', description: 'Azure Cache for Redis port' },
      {
        key: 'AZURE_REDIS_PASSWORD',
        defaultValue: '',
        description: 'Azure Cache for Redis access key',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/cache',
    claudeMdSection: [
      '## Azure Cache for Redis',
      'Azure Cache for Redis is used for caching. Connect via AZURE_REDIS_HOST with TLS on port 6380.',
      'Use access keys or managed identity for authentication.',
    ].join('\n'),
    cursorRules: [
      'Connect to Azure Cache via ioredis. Use TLS (port 6380) and access key from env.',
      'Design cache keys with clear namespacing. Use managed identity in production.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Cache for Redis via ioredis. Host from AZURE_REDIS_HOST env, TLS on port 6380.',
      'Access key from AZURE_REDIS_PASSWORD. Managed identity auth in production.',
    ].join('\n'),
  },
  {
    id: 'azure-front-door',
    name: 'Azure Front Door',
    description: 'Azure Front Door CDN and global load balancer',
    category: 'Cloud — Azure',
    dependencies: {},
    devDependencies: {},
    envVars: [
      {
        key: 'AZURE_FRONTDOOR_HOSTNAME',
        defaultValue: '',
        description: 'Azure Front Door hostname',
      },
      {
        key: 'AZURE_FRONTDOOR_HEADER',
        defaultValue: 'X-Azure-FDID',
        description: 'Front Door ID header name',
      },
      {
        key: 'AZURE_FRONTDOOR_ID',
        defaultValue: '',
        description: 'Azure Front Door ID for request validation',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'cloud-azure/front-door',
    claudeMdSection: [
      '## Azure Front Door',
      'Validate that requests come through Front Door by checking the X-Azure-FDID header.',
      'Configure Front Door hostname and ID via environment variables.',
    ].join('\n'),
    cursorRules: [
      'Validate X-Azure-FDID header to ensure traffic comes through Front Door.',
      'Set AZURE_FRONTDOOR_ID from env. Block direct-to-origin requests in production.',
    ].join('\n'),
    copilotInstructions: [
      'Azure Front Door validated via X-Azure-FDID header. Config from env.',
      'Front Door is configured at infrastructure level. App validates origin of requests.',
    ].join('\n'),
  },

  // ─── API Patterns ────────────────────────────────────────────────
  {
    id: 'idempotency',
    name: 'Idempotency Key',
    description: 'Idempotency-Key header support for safe request retries',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'idempotency',
    claudeMdSection:
      '## Idempotency\nUse @Idempotent() decorator on POST/PUT endpoints. Clients send Idempotency-Key header. Responses are cached and replayed for duplicate keys.',
    cursorRules:
      'Apply @Idempotent() decorator to POST and PUT endpoints that create or modify resources. Requires a cache store (in-memory by default, Redis recommended for production).',
    copilotInstructions:
      'Use @Idempotent() decorator on mutation endpoints. Clients must send Idempotency-Key header for safe retries.',
  },
  {
    id: 'prefer-header',
    name: 'Prefer Header',
    description: 'RFC 7240 Prefer header for return=representation and respond-async',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'prefer-header',
    claudeMdSection:
      '## Prefer Header (RFC 7240)\nThe PreferInterceptor parses the Prefer request header and applies return=minimal (204 No Content), return=representation (full body), and respond-async preferences. Applied preferences are echoed in the Preference-Applied response header.',
    cursorRules:
      'The PreferInterceptor handles Prefer header parsing globally. Handlers receive normal requests; the interceptor adjusts responses based on return=minimal, return=representation, and respond-async preferences.',
    copilotInstructions:
      'PreferInterceptor is registered globally. It supports Prefer: return=minimal (returns 204), return=representation (returns full body), and respond-async. Applied preferences are listed in Preference-Applied header.',
  },
  {
    id: 'content-digest',
    name: 'Content Digest',
    description: 'RFC 9530 content integrity verification via digest headers',
    category: 'Security',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'content-digest',
    claudeMdSection:
      '## Content Digest (RFC 9530)\nContentDigestInterceptor adds sha-256 Content-Digest and Repr-Digest response headers for payload integrity. ContentDigestGuard optionally validates inbound Content-Digest headers on requests.',
    cursorRules:
      'ContentDigestInterceptor hashes JSON response bodies with SHA-256 and sets Content-Digest and Repr-Digest headers. ContentDigestGuard validates the Content-Digest header on incoming requests if present.',
    copilotInstructions:
      'ContentDigestInterceptor is applied globally to add Content-Digest and Repr-Digest headers to responses. ContentDigestGuard validates inbound Content-Digest headers when present. Based on RFC 9530.',
  },
  {
    id: 'dpop',
    name: 'DPoP (Proof of Possession)',
    description: 'RFC 9449 Demonstrating Proof of Possession for OAuth tokens',
    category: 'Auth',
    dependencies: { jose: '6.0.11' },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'aws-lambda', 'full-stack', 'monorepo'],
    templateDir: 'dpop',
    claudeMdSection:
      '## DPoP (RFC 9449)\nDPoPGuard validates DPoP proof JWTs on protected endpoints. It checks the proof typ, htm (method), htu (URI), and token age. Apply the guard to routes that require proof-of-possession tokens.',
    cursorRules:
      'DPoPGuard validates DPoP proof JWTs per RFC 9449. It verifies typ=dpop+jwt, htm matches the HTTP method, htu matches the request URI, and the proof is not older than 300 seconds.',
    copilotInstructions:
      'DPoPGuard is used to protect endpoints with DPoP proof-of-possession. Clients must send a DPoP header with a dpop+jwt and use the DPoP authorization scheme. Uses the jose library for JWT validation.',
  },
  {
    id: 'json-patch',
    name: 'JSON Patch',
    description: 'RFC 6902 JSON Patch for granular document updates',
    category: 'API Patterns',
    dependencies: { 'fast-json-patch': '3.1.1' },
    devDependencies: {},
    envVars: [],
    conflicts: ['json-merge-patch'],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'json-patch',
    claudeMdSection:
      '## JSON Patch (RFC 6902)\nUse JsonPatchValidationPipe on PATCH endpoints that accept `application/json-patch+json`. The pipe validates the operation array (add, remove, replace, move, copy, test). Apply patches with fast-json-patch.',
    cursorRules:
      'JsonPatchValidationPipe validates RFC 6902 operation arrays. Use fast-json-patch applyPatch() to apply validated operations to documents. Set Accept-Patch header to application/json-patch+json.',
    copilotInstructions:
      'Use JsonPatchValidationPipe on PATCH endpoints for RFC 6902 support. Pipe validates op, path, value, and from fields. Apply with fast-json-patch. Content-Type is application/json-patch+json.',
  },
  {
    id: 'json-merge-patch',
    name: 'JSON Merge Patch',
    description: 'RFC 7396 JSON Merge Patch for simple partial updates',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: ['json-patch'],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'json-merge-patch',
    claudeMdSection:
      '## JSON Merge Patch (RFC 7396)\nUse MergePatchValidationPipe on PATCH endpoints that accept `application/merge-patch+json`. The pipe ensures the body is a plain JSON object. Null values in the patch delete the corresponding key from the target.',
    cursorRules:
      'MergePatchValidationPipe validates RFC 7396 merge patch bodies. The body must be a JSON object (not array or null). Null values mean "delete this key". Nested objects are merged recursively.',
    copilotInstructions:
      'Use MergePatchValidationPipe on PATCH endpoints for RFC 7396 support. Body must be a JSON object. Null values delete keys. Content-Type is application/merge-patch+json. No extra dependencies required.',
  },

  // ─── Server-Sent Events ───────────────────────────────────────────
  {
    id: 'sse',
    name: 'Server-Sent Events',
    description: 'Lightweight real-time server-to-client streaming',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'sse',
    claudeMdSection: [
      '## Server-Sent Events',
      'Use @Sse() decorator on controller methods to return an Observable<MessageEvent>.',
      'SSE is built into NestJS — no extra dependencies required. Use a Subject to push events from services.',
    ].join('\n'),
    cursorRules: [
      'Use @Sse() decorator for SSE endpoints. Return Observable<MessageEvent> from rxjs.',
      'Push events via a Subject. SSE is server-to-client only — use WebSockets for bidirectional.',
    ].join('\n'),
    copilotInstructions: [
      'SSE endpoints use the @Sse() decorator and return Observable<MessageEvent>.',
      'No extra dependencies needed — SSE is built into NestJS. Use rxjs Subject to emit events.',
    ].join('\n'),
  },

  // ─── Soft Delete ──────────────────────────────────────────────────
  {
    id: 'soft-delete',
    name: 'Soft Delete',
    description: 'Mark records as deleted instead of removing them (TypeORM)',
    category: 'Database',
    dependencies: {
      '@nestjs/typeorm': '10.0.2',
      typeorm: '0.3.20',
    },
    devDependencies: {},
    envVars: [],
    conflicts: ['prisma', 'mongoose', 'drizzle-postgres', 'kysely', 'mikro-orm'],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'soft-delete',
    claudeMdSection: [
      '## Soft Delete',
      'Extend SoftDeletableEntity for entities that should be soft-deleted.',
      'Use repository.softRemove() or repository.softDelete() instead of remove()/delete().',
      'Use @WithDeleted() decorator to include soft-deleted records in queries.',
    ].join('\n'),
    cursorRules: [
      'Extend SoftDeletableEntity for soft-deletable entities. Use softRemove()/softDelete() instead of remove()/delete().',
      'Query soft-deleted records with withDeleted: true or the @WithDeleted() decorator.',
    ].join('\n'),
    copilotInstructions: [
      'Soft-deletable entities extend SoftDeletableEntity which adds a deletedAt column.',
      'Use softRemove()/softDelete() for deletion. Use @WithDeleted() to include deleted records.',
    ].join('\n'),
  },

  // ─── Audit Trail ──────────────────────────────────────────────────
  {
    id: 'audit-trail',
    name: 'Audit Trail',
    description: 'Record entity changes with user, action, and diff',
    category: 'Database',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'audit-trail',
    claudeMdSection: [
      '## Audit Trail',
      'Apply AuditInterceptor globally or per-controller to log mutating requests (POST, PUT, PATCH, DELETE).',
      'Use @Auditable() decorator to mark controllers or handlers for audit logging.',
      'Audit entries capture userId, action, entityName, entityId, changes, timestamp, and IP.',
    ].join('\n'),
    cursorRules: [
      'Use AuditInterceptor to capture mutating request audit entries. Apply globally or per-controller.',
      'Mark controllers with @Auditable() decorator. Entries include user, action, entity, changes, and IP.',
    ].join('\n'),
    copilotInstructions: [
      'AuditInterceptor logs POST/PUT/PATCH/DELETE requests with user, entity, and change information.',
      'Use @Auditable() to mark auditable controllers. Consider TypeORM subscribers for entity-level auditing.',
    ].join('\n'),
  },

  // ─── Request Context (CLS) ───────────────────────────────────────
  {
    id: 'request-context',
    name: 'Request Context (CLS)',
    description: 'AsyncLocalStorage-based request context via nestjs-cls',
    category: 'API Patterns',
    dependencies: {
      'nestjs-cls': '4.5.0',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'request-context',
    claudeMdSection: [
      '## Request Context (CLS)',
      'Import RequestContextModule to enable AsyncLocalStorage-based request context.',
      'Inject ClsService to access correlationId, userId, and ip anywhere in the request lifecycle.',
      'Context is set up automatically via middleware — no manual setup needed per request.',
    ].join('\n'),
    cursorRules: [
      'Use ClsService from nestjs-cls to access request context (correlationId, userId, ip).',
      'Import RequestContextModule in AppModule. Context is auto-populated via middleware.',
    ].join('\n'),
    copilotInstructions: [
      'nestjs-cls provides AsyncLocalStorage-based request context. Inject ClsService to read correlationId, userId, ip.',
      'RequestContextModule sets up CLS middleware automatically. No manual context threading needed.',
    ].join('\n'),
  },
  // ─── i18n ─────────────────────────────────────────────────────────
  {
    id: 'i18n',
    name: 'Internationalization',
    description: 'Multi-language support with nestjs-i18n',
    category: 'API Patterns',
    dependencies: {
      'nestjs-i18n': '10.8.4',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'i18n',
    claudeMdSection: [
      '## Internationalization (i18n)',
      'Uses nestjs-i18n for multi-language support. Translation files live in `src/i18n/<lang>/`.',
      'Language is resolved from the `lang` query parameter or the `Accept-Language` header. Fallback language is `en`.',
    ].join('\n'),
    cursorRules:
      'Use nestjs-i18n I18nService for translations. Translation JSON files live in src/i18n/<lang>/. Fallback language is en. Language is resolved from query param or Accept-Language header.',
    copilotInstructions:
      'nestjs-i18n handles multi-language support. Inject I18nService for translations. Translation files are in src/i18n/<lang>/common.json. Supports query param and Accept-Language header resolution.',
  },

  // ─── Config Validation ────────────────────────────────────────────
  {
    id: 'config-validation',
    name: 'Config Schema Validation',
    description: 'Validate environment variables at startup with typed schemas',
    category: 'DX',
    dependencies: {
      zod: '3.25.67',
    },
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'config-validation',
    claudeMdSection: [
      '## Config Schema Validation',
      'Environment variables are validated at startup using Zod schemas in `src/config/env.validation.ts`.',
      'Add new env vars to the schema \u2014 the app will fail fast with descriptive errors if validation fails.',
    ].join('\n'),
    cursorRules:
      'Environment variables are validated at startup via Zod in src/config/env.validation.ts. Add new env vars to the schema. The app fails fast with clear errors on invalid config.',
    copilotInstructions:
      'Env vars are validated at startup with Zod schemas in src/config/env.validation.ts. Use the EnvConfig type for typed config access. Add new env vars to the schema to enforce validation.',
  },

  // ─── Dead Letter Queue ────────────────────────────────────────────
  {
    id: 'dead-letter-queue',
    name: 'Dead Letter Queue',
    description: 'Handle permanently failed messages with DLQ routing and replay',
    category: 'Queue',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'microservice', 'scheduled-worker', 'monorepo', 'full-stack'],
    templateDir: 'dead-letter-queue',
    claudeMdSection: [
      '## Dead Letter Queue',
      'Failed messages are routed to a DLQ via `DeadLetterQueueService`. Inspect and replay dead letters through the service API.',
      'Integrate with BullMQ or RabbitMQ by calling `dlqService.add()` in your error handlers.',
    ].join('\n'),
    cursorRules:
      'DeadLetterQueueService stores permanently failed messages. Call dlqService.add() in queue error handlers. Use getAll()/getByQueue() to inspect and remove() to clear entries.',
    copilotInstructions:
      'DeadLetterQueueService handles permanently failed queue messages. Inject it in queue consumers and call add() on unrecoverable errors. Supports inspection by queue name and removal by id.',
  },

  // ─── Webhooks ─────────────────────────────────────────────────────
  {
    id: 'webhooks',
    name: 'Webhook Delivery',
    description: 'Outbound webhook system with HMAC signing and retry',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [
      {
        key: 'WEBHOOK_SECRET',
        defaultValue: 'change-me',
        description: 'HMAC secret for webhook signatures',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'webhooks',
    claudeMdSection: [
      '## Webhook Delivery',
      'Outbound webhooks are sent via `WebhookService`. Payloads are HMAC-signed with SHA-256 using the `WEBHOOK_SECRET` env var.',
      'Signature is sent in the `X-Webhook-Signature` header. Consumers verify by computing HMAC of the raw body.',
    ].join('\n'),
    cursorRules:
      'WebhookService delivers outbound webhooks with HMAC-SHA256 signatures. Inject it and call deliver(url, payload). Signature is in X-Webhook-Signature header. Set WEBHOOK_SECRET env var.',
    copilotInstructions:
      'WebhookService sends outbound webhooks signed with HMAC-SHA256. Inject ConfigService for the WEBHOOK_SECRET. Call deliver(url, payload) to send. Includes 10s timeout via AbortSignal.',
  },

  // ─── Data Masking / PII Redaction ──────────────────────────────────
  {
    id: 'data-masking',
    name: 'Data Masking',
    description: 'Automatic PII redaction in logs and API responses',
    category: 'Security',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'data-masking',
    claudeMdSection: [
      '## Data Masking / PII Redaction',
      'Use @Sensitive() decorator on DTO properties to mask values in API responses (toPlainOnly).',
      'Use maskEmail(), maskPhone(), maskCreditCard(), maskIban() utils for manual masking in logs.',
      'Masking is applied automatically by class-transformer when serializing to plain objects.',
    ].join('\n'),
    cursorRules: [
      'Apply @Sensitive() decorator to DTO fields containing PII. Masking only applies on serialization (toPlainOnly).',
      'Use mask utility functions for log redaction. Never log raw PII — always mask before writing to logs.',
    ].join('\n'),
    copilotInstructions: [
      'Use @Sensitive() on DTO properties for auto-masking in responses. Uses class-transformer Transform.',
      'Mask utilities: maskEmail(), maskPhone(), maskCreditCard(), maskIban(). Apply in log statements for PII redaction.',
    ].join('\n'),
  },

  // ─── Response Serialization Groups ────────────────────────────────
  {
    id: 'serialization-groups',
    name: 'Response Serialization Groups',
    description: 'Return different field sets based on role or endpoint',
    category: 'API Patterns',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'serialization-groups',
    claudeMdSection: [
      '## Response Serialization Groups',
      'Use Serialize(DtoClass) decorator on controller methods to control which fields are returned.',
      'Mark DTO properties with @Expose() and optionally { groups: [...] } for role-based field visibility.',
      'The SerializeInterceptor uses class-transformer plainToInstance with excludeExtraneousValues.',
    ].join('\n'),
    cursorRules: [
      'Use Serialize(DtoClass) on controller methods. Mark DTO fields with @Expose() to include them.',
      'Use groups on @Expose({ groups: ["admin"] }) for role-based serialization. Unlisted fields are excluded.',
    ].join('\n'),
    copilotInstructions: [
      'Serialize(DtoClass) decorator applies SerializeInterceptor to transform responses.',
      'DTO fields need @Expose() to be included. Use @Exclude() or omit @Expose() to hide fields. Groups enable role-based visibility.',
    ].join('\n'),
  },

  // ─── Transactional Outbox ─────────────────────────────────────────
  {
    id: 'transactional-outbox',
    name: 'Transactional Outbox',
    description: 'Guarantee at-least-once event delivery alongside database writes (TypeORM)',
    category: 'Database',
    dependencies: {
      '@nestjs/typeorm': '10.0.2',
      typeorm: '0.3.20',
    },
    devDependencies: {},
    envVars: [],
    conflicts: ['prisma', 'mongoose', 'drizzle-postgres', 'kysely', 'mikro-orm'],
    requires: [],
    compatibleWith: ['http-api', 'microservice', 'scheduled-worker', 'full-stack', 'monorepo'],
    templateDir: 'transactional-outbox',
    claudeMdSection: [
      '## Transactional Outbox',
      'Use OutboxService.addMessage() within a transaction to guarantee at-least-once event delivery.',
      'Events are written to the `outbox` table atomically alongside business data, then published by a polling publisher.',
      'Mark events as published after successful delivery. Consider CDC (Debezium) for higher throughput.',
    ].join('\n'),
    cursorRules: [
      'Use OutboxService.addMessage() inside EntityManager transactions. Never publish events outside a transaction.',
      'The outbox table stores unpublished events. A polling publisher reads and publishes them, then marks published=true.',
    ].join('\n'),
    copilotInstructions: [
      'OutboxService writes events to the outbox table within the same DB transaction as business data.',
      'A polling publisher picks up unpublished rows and delivers them. For higher throughput, consider CDC with Debezium.',
    ].join('\n'),
  },

  // ─── Social OAuth ──────────────────────────────────────────────────
  {
    id: 'oauth-google',
    name: 'Google OAuth',
    description: 'Google OAuth 2.0 login via Passport',
    category: 'Auth',
    dependencies: {
      'passport-google-oauth20': '2.0.0',
      '@nestjs/passport': '10.0.3',
      passport: '0.7.0',
    },
    devDependencies: {
      '@types/passport-google-oauth20': '2.0.16',
    },
    envVars: [
      {
        key: 'GOOGLE_CLIENT_ID',
        defaultValue: '',
        description: 'Google OAuth 2.0 client ID from Google Cloud Console',
      },
      {
        key: 'GOOGLE_CLIENT_SECRET',
        defaultValue: '',
        description: 'Google OAuth 2.0 client secret from Google Cloud Console',
      },
      {
        key: 'GOOGLE_CALLBACK_URL',
        defaultValue: 'http://localhost:3000/auth/google/callback',
        description: 'OAuth callback URL registered in Google Cloud Console',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'oauth-google',
    claudeMdSection: [
      '## Google OAuth',
      'Google OAuth 2.0 login is handled by GoogleStrategy via passport-google-oauth20.',
      'Protect routes with @UseGuards(GoogleAuthGuard). The callback route receives the authenticated user profile.',
    ].join('\n'),
    cursorRules: [
      'Use @UseGuards(GoogleAuthGuard) to initiate Google login and handle the callback.',
      'GoogleStrategy validates the OAuth response and maps the profile to a local user object.',
    ].join('\n'),
    copilotInstructions: [
      'Google OAuth is integrated via passport-google-oauth20 and @nestjs/passport.',
      'Use GoogleAuthGuard on login and callback routes. Configure credentials in environment variables.',
    ].join('\n'),
  },
  {
    id: 'oauth-github',
    name: 'GitHub OAuth',
    description: 'GitHub OAuth 2.0 login via Passport',
    category: 'Auth',
    dependencies: {
      'passport-github2': '0.1.12',
      '@nestjs/passport': '10.0.3',
      passport: '0.7.0',
    },
    devDependencies: {
      '@types/passport-github2': '1.2.9',
    },
    envVars: [
      {
        key: 'GITHUB_CLIENT_ID',
        defaultValue: '',
        description: 'GitHub OAuth App client ID from GitHub Developer Settings',
      },
      {
        key: 'GITHUB_CLIENT_SECRET',
        defaultValue: '',
        description: 'GitHub OAuth App client secret from GitHub Developer Settings',
      },
      {
        key: 'GITHUB_CALLBACK_URL',
        defaultValue: 'http://localhost:3000/auth/github/callback',
        description: 'OAuth callback URL registered in GitHub Developer Settings',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'oauth-github',
    claudeMdSection: [
      '## GitHub OAuth',
      'GitHub OAuth login is handled by GitHubStrategy via passport-github2.',
      'Protect routes with @UseGuards(GitHubAuthGuard). The callback route receives the authenticated user profile.',
    ].join('\n'),
    cursorRules: [
      'Use @UseGuards(GitHubAuthGuard) to initiate GitHub login and handle the callback.',
      'GitHubStrategy validates the OAuth response and maps the profile to a local user object.',
    ].join('\n'),
    copilotInstructions: [
      'GitHub OAuth is integrated via passport-github2 and @nestjs/passport.',
      'Use GitHubAuthGuard on login and callback routes. Configure credentials in environment variables.',
    ].join('\n'),
  },
  {
    id: 'oauth-apple',
    name: 'Apple OAuth',
    description: 'Sign in with Apple via Passport',
    category: 'Auth',
    dependencies: {
      'passport-apple': '2.0.2',
      '@nestjs/passport': '10.0.3',
      passport: '0.7.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'APPLE_CLIENT_ID',
        defaultValue: '',
        description: 'Apple Services ID (e.g. com.example.app)',
      },
      {
        key: 'APPLE_TEAM_ID',
        defaultValue: '',
        description: 'Apple Developer Team ID',
      },
      {
        key: 'APPLE_KEY_ID',
        defaultValue: '',
        description: 'Apple Sign In private key ID',
      },
      {
        key: 'APPLE_PRIVATE_KEY_PATH',
        defaultValue: '',
        description: 'Path to Apple Sign In private key (.p8 file)',
      },
      {
        key: 'APPLE_CALLBACK_URL',
        defaultValue: 'http://localhost:3000/auth/apple/callback',
        description: 'OAuth callback URL registered in Apple Developer Portal',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'oauth-apple',
    claudeMdSection: [
      '## Apple OAuth',
      'Sign in with Apple is handled by AppleStrategy via passport-apple.',
      'Protect routes with @UseGuards(AppleAuthGuard). Apple returns user info only on the first login.',
    ].join('\n'),
    cursorRules: [
      'Use @UseGuards(AppleAuthGuard) to initiate Apple login and handle the callback.',
      'AppleStrategy validates the OAuth response. Note: Apple only sends user name/email on the first authorization.',
    ].join('\n'),
    copilotInstructions: [
      'Sign in with Apple is integrated via passport-apple and @nestjs/passport.',
      'Use AppleAuthGuard on login and callback routes. Apple only returns user details on first authorization.',
    ].join('\n'),
  },

  // ─── Docker Compose Dev ──────────────────────────────────────────
  {
    id: 'docker-compose-dev',
    name: 'Docker Compose Dev',
    description: 'One-command local dev environment with hot reload',
    category: 'DX',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'microservice', 'scheduled-worker', 'full-stack', 'monorepo'],
    templateDir: 'docker-compose-dev',
    claudeMdSection: [
      '## Docker Compose Dev',
      'Start the full local environment with `docker compose -f docker-compose.dev.yml up`.',
      'Hot reload is enabled via volume mounts. Debug port 9229 is exposed for Node.js inspector.',
      'Adminer is available at http://localhost:8080 for database management.',
    ].join('\n'),
    cursorRules: [
      'Use docker-compose.dev.yml for local development. Run `docker compose -f docker-compose.dev.yml up`.',
      'Services: app (port 3000 + debug 9229), postgres (5432), redis (6379), adminer (8080).',
    ].join('\n'),
    copilotInstructions: [
      'Local dev runs via docker-compose.dev.yml with hot reload and debug support.',
      'Postgres, Redis, and Adminer are included. Use .env for configuration.',
    ].join('\n'),
  },

  // ─── Load Testing (k6) ──────────────────────────────────────────
  {
    id: 'load-testing',
    name: 'Load Testing (k6)',
    description: 'Performance and load testing with Grafana k6',
    category: 'Testing',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'load-testing',
    claudeMdSection: [
      '## Load Testing (k6)',
      'Load tests live in `k6/`. Smoke test: `k6 run k6/smoke.js`. Stress test: `k6 run k6/stress.js`.',
      'k6 is a standalone binary — install from https://grafana.com/docs/k6/latest/set-up/install-k6/.',
      'Thresholds are defined in each test script to enforce SLOs.',
    ].join('\n'),
    cursorRules: [
      'k6 test scripts are in k6/ directory. Use `k6 run <script>` to execute.',
      'Define thresholds for p95 latency and error rate in each test script.',
    ].join('\n'),
    copilotInstructions: [
      'k6 load tests are in k6/. Run with `k6 run k6/smoke.js` or `k6 run k6/stress.js`.',
      'k6 is a standalone Go binary, not an npm dependency. Install separately.',
    ].join('\n'),
  },

  // ─── Worker Threads ──────────────────────────────────────────────
  {
    id: 'worker-threads',
    name: 'Worker Threads',
    description: 'Offload CPU-intensive tasks to worker threads',
    category: 'Operational',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: 'worker-threads',
    claudeMdSection: [
      '## Worker Threads',
      'Use `WorkerPool` to offload CPU-intensive work (image processing, PDF generation, crypto) to worker threads.',
      'Inject `WorkerPool` and call `run<T>(script, data)` — it manages a pool sized to `os.cpus().length - 1`.',
      'Do not use worker threads for I/O-bound work — use async/await instead.',
    ].join('\n'),
    cursorRules: [
      'Use WorkerPool.run() for CPU-intensive tasks. Pool size is auto-configured to (CPU count - 1).',
      'Worker scripts receive data via workerData and send results via parentPort.postMessage().',
    ].join('\n'),
    copilotInstructions: [
      'WorkerPool is an injectable NestJS service for offloading CPU-intensive tasks to worker threads.',
      'Uses Node.js built-in worker_threads module. Not suitable for I/O-bound work.',
    ].join('\n'),
  },

  // ─── File Upload ────────────────────────────────────────────────
  {
    id: 'file-upload',
    name: 'File Upload',
    description: 'Multipart file upload with validation and streaming',
    category: 'API Patterns',
    dependencies: {
      '@fastify/multipart': '9.0.3',
    },
    expressDependencies: {
      multer: '1.4.5-lts.2',
    },
    devDependencies: {
      '@types/multer': '2.1.0',
    },
    envVars: [
      {
        key: 'MAX_FILE_SIZE_MB',
        defaultValue: '50',
        description: 'Max upload size in MB',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'file-upload',
    claudeMdSection: [
      '## File Upload',
      'Use `FileUploadInterceptor` on upload routes.',
      'Validate files with `FileValidationPipe` — configure allowed MIME types and max size.',
      'Access the uploaded file via `(request as any).uploadedFile` after the interceptor runs.',
    ].join('\n'),
    cursorRules: [
      'Use FileUploadInterceptor + FileValidationPipe for multipart uploads.',
      'Access uploaded file from request.uploadedFile. Configure MAX_FILE_SIZE_MB in environment.',
    ].join('\n'),
    copilotInstructions: [
      'File uploads use a custom FileUploadInterceptor and FileValidationPipe.',
      'FileUploadInterceptor extracts the file, FileValidationPipe checks MIME type and size.',
    ].join('\n'),
  },

  // ─── Two-Factor Authentication (TOTP) ──────────────────────────
  {
    id: 'mfa-totp',
    name: 'Two-Factor Authentication (TOTP)',
    description: 'TOTP-based 2FA with backup codes',
    category: 'Auth',
    dependencies: {
      otplib: '12.0.1',
      qrcode: '1.5.4',
    },
    devDependencies: {
      '@types/qrcode': '1.5.5',
    },
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'mfa-totp',
    claudeMdSection: [
      '## Two-Factor Authentication (TOTP)',
      'Use `TotpService` to generate secrets, QR codes, and verify TOTP tokens.',
      'Call `generateSecret()` during 2FA setup, `generateQrCode()` to display the QR code, and `verify()` to validate tokens.',
      'Store backup codes hashed — they are single-use recovery codes.',
    ].join('\n'),
    cursorRules: [
      'Use TotpService for all TOTP operations. generateSecret() creates the shared secret, verify() validates tokens.',
      'Backup codes from generateBackupCodes() are single-use. Hash them before storing in the database.',
    ].join('\n'),
    copilotInstructions: [
      'TotpService wraps otplib for TOTP 2FA. Generate secrets, QR codes (via qrcode), and verify tokens.',
      'Backup codes are plain strings — hash before persisting. They are single-use recovery codes.',
    ].join('\n'),
  },
  // ─── AdminJS ──────────────────────────────────────────────────────
  {
    id: 'adminjs',
    name: 'AdminJS',
    description: 'Auto-generated CRUD admin panel with authentication',
    category: 'DX',
    dependencies: {
      adminjs: '7.8.13',
      '@adminjs/nestjs': '6.1.0',
      '@adminjs/fastify': '4.1.0',
    },
    expressDependencies: {
      adminjs: '7.8.13',
      '@adminjs/nestjs': '6.1.0',
      '@adminjs/express': '6.1.0',
      express: '5.1.0',
      'express-session': '1.18.1',
      'express-formidable': '1.2.0',
    },
    devDependencies: {},
    envVars: [
      {
        key: 'ADMIN_EMAIL',
        defaultValue: 'admin@example.com',
        description: 'AdminJS login email',
      },
      {
        key: 'ADMIN_PASSWORD',
        defaultValue: 'changeme',
        description: 'AdminJS login password',
      },
    ],
    conflicts: [],
    requires: [],
    compatibleWith: ['http-api', 'full-stack', 'monorepo'],
    templateDir: 'adminjs',
    claudeMdSection:
      '## AdminJS\nAdmin panel available at /admin. Register resources in admin.module.ts. Authentication uses ADMIN_EMAIL/ADMIN_PASSWORD env vars.',
    cursorRules:
      'AdminJS panel at /admin. Register entities as AdminJS resources in AdminModule. Use AdminJS features (actions, components) for customization.',
    copilotInstructions:
      'AdminJS provides an auto-generated admin panel at /admin. Add entity resources in the AdminModule to expose CRUD operations.',
  },
];

export function registerAllRecipes(registry: RecipeRegistry): void {
  for (const recipe of recipeDefinitions) {
    registry.register(recipe);
  }
}
