export const PROJECT_TYPES = [
  'http-api',
  'aws-lambda',
  'microservice',
  'cli-app',
  'scheduled-worker',
  'monorepo',
  'full-stack',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const TRANSPORT_LAYERS = [
  'tcp',
  'redis',
  'nats',
  'mqtt',
  'rabbitmq',
  'kafka',
  'grpc',
  'custom',
] as const;

export type TransportLayer = (typeof TRANSPORT_LAYERS)[number];

export const FRONTEND_FRAMEWORKS = ['nextjs', 'vite-react', 'nuxt', 'sveltekit'] as const;

export type FrontendFramework = (typeof FRONTEND_FRAMEWORKS)[number];

export const CLOUD_PROVIDERS = ['aws', 'gcp', 'azure', 'none'] as const;

export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export const DEPLOYMENT_TARGETS = [
  'dockerfile',
  'docker-compose',
  'kubernetes',
  'serverless-framework',
  'terraform',
] as const;

export type DeploymentTarget = (typeof DEPLOYMENT_TARGETS)[number];

export const CI_CD_PROVIDERS = [
  'github-actions',
  'azure-devops',
  'aws-codepipeline',
  'gcp-cloudbuild',
] as const;

export type CiCdProvider = (typeof CI_CD_PROVIDERS)[number];

export const RECIPE_IDS = [
  'typeorm-postgres',
  'typeorm-mysql',
  'prisma',
  'mongoose',
  'drizzle-postgres',
  'kysely',
  'redis-cache',
  'rabbitmq',
  'bullmq',
  'jwt-auth',
  'passport',
  'auth-flows',
  'api-keys',
  'oauth2-introspection',
  'oauth-google',
  'oauth-github',
  'oauth-apple',
  'rbac-casl',
  'swagger',
  'pino',
  'winston',
  'health-checks',
  'prometheus',
  'sentry',
  'seq2',
  's3-minio',
  'nodemailer',
  'sendgrid',
  'websockets',
  'graphql-mercurius',
  'cqrs',
  'throttler',
  'helmet',
  'cors',
  'csrf',
  'pagination',
  'filtering',
  'api-versioning',
  'correlation-id',
  'http-caching',
  'opentelemetry',
  'request-logging',
  'distributed-tracing',
  'devcontainer',
  'database-seeding',
  'database-factories',
  'sdk-generation',
  'graceful-shutdown',
  'circuit-breaker',
  'feature-flags',
  'multi-tenancy',
  'changelog',
  'license',
  'env-per-environment',
  'dependabot-renovate',
  'docs-site',
  'idempotency',
  'prefer-header',
  'content-digest',
  'dpop',
  'json-patch',
  'json-merge-patch',
  'sse',
  'soft-delete',
  'audit-trail',
  'request-context',
  'i18n',
  'config-validation',
  'dead-letter-queue',
  'webhooks',
  'data-masking',
  'serialization-groups',
  'transactional-outbox',
  'mikro-orm',
  'docker-compose-dev',
  'load-testing',
  'worker-threads',
  'file-upload',
  'mfa-totp',
  'adminjs',

  // ─── AWS ──────────────────────────────────────────────────────────
  'aws-sqs',
  'aws-sns',
  'aws-eventbridge',
  'aws-secrets-manager',
  'aws-ssm',
  'aws-s3',
  'aws-cognito',
  'aws-cloudwatch',
  'aws-rds',
  'aws-dynamodb',
  'aws-elasticache',
  'aws-cloudfront',

  // ─── GCP ──────────────────────────────────────────────────────────
  'gcp-pubsub',
  'gcp-secret-manager',
  'gcp-cloud-storage',
  'gcp-cloud-functions',
  'gcp-firebase-auth',
  'gcp-cloud-logging',
  'gcp-cloud-sql',
  'gcp-firestore',
  'gcp-memorystore',
  'gcp-cloud-cdn',

  // ─── Azure ────────────────────────────────────────────────────────
  'azure-service-bus',
  'azure-key-vault',
  'azure-blob-storage',
  'azure-functions',
  'azure-entra-id',
  'azure-app-insights',
  'azure-cosmos-db',
  'azure-sql-database',
  'azure-cache',
  'azure-front-door',
] as const;

export type RecipeId = (typeof RECIPE_IDS)[number];

export interface ProjectConfig {
  name: string;
  scope: string | undefined;
  projectType: ProjectType;
  cloudProvider: CloudProvider;
  recipes: RecipeId[];
  transportLayer: TransportLayer | undefined;
  frontendFramework: FrontendFramework | undefined;
  deploymentTargets: DeploymentTarget[];
  ciCdProvider: CiCdProvider | undefined;
  outputDir: string;
}

export interface ModuleImportMeta {
  moduleName: string;
  importPath: string;
}

export interface MainTsBlockImport {
  defaultImport?: string;
  namedImports: string[];
  moduleSpecifier: string;
}

export interface MainTsSetup {
  blockId: string;
  block: {
    imports: MainTsBlockImport[];
    code: string;
  };
}

export interface RecipeDefinition {
  id: RecipeId;
  name: string;
  description: string;
  category: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  envVars: EnvVar[];
  conflicts: RecipeId[];
  requires: RecipeId[];
  compatibleWith: ProjectType[] | 'all';
  templateDir: string;
  claudeMdSection: string;
  cursorRules: string;
  copilotInstructions: string;
  moduleImport?: ModuleImportMeta;
  mainTsSetup?: MainTsSetup;
}

export interface EnvVar {
  key: string;
  defaultValue: string;
  description: string;
}

export interface GeneratorContext {
  config: ProjectConfig;
  outputDir: string;
  templatesDir: string;
}
