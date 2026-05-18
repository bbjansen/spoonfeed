import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig, RecipeId, CloudProvider } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

// ── Cloud-specific recipe groupings ────────────────────────────────────

const AWS_RECIPES: RecipeId[] = [
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
];

const GCP_RECIPES: RecipeId[] = [
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
];

const AZURE_RECIPES: RecipeId[] = [
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
];

/** Default recipes pre-selected per cloud provider (mirrors CLOUD_DEFAULTS in run-all.ts) */
const CLOUD_DEFAULTS: Record<CloudProvider, RecipeId[]> = {
  aws: ['aws-secrets-manager', 'aws-s3'],
  gcp: ['gcp-secret-manager', 'gcp-cloud-storage'],
  azure: ['azure-key-vault', 'azure-blob-storage'],
  none: [],
};

/** Known package prefixes that identify a cloud provider's deps */
const AWS_DEP_PATTERNS = ['@aws-sdk/'];
const GCP_DEP_PATTERNS = ['@google-cloud/', 'firebase-admin'];
const AZURE_DEP_PATTERNS = ['@azure/', 'applicationinsights'];

// ── Helpers ────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'test-project',
    scope: undefined,
    projectType: 'http-api',
    cloudProvider: 'none',
    httpAdapter: 'fastify',
    recipes: [],
    transportLayer: undefined,
    frontendFramework: undefined,
    deploymentTargets: [],
    ciCdProvider: undefined,
    outputDir: '',
    ...overrides,
  };
}

function readFile(outputDir: string, filePath: string): string {
  return fs.readFileSync(path.join(outputDir, filePath), 'utf-8');
}

function readJson(outputDir: string, filePath: string): Record<string, unknown> {
  return JSON.parse(readFile(outputDir, filePath)) as Record<string, unknown>;
}

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

function depNames(pkg: Record<string, unknown>): string[] {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  return [...Object.keys(deps), ...Object.keys(devDeps)];
}

function hasAnyPattern(names: string[], patterns: string[]): boolean {
  return names.some((n) => patterns.some((p) => n.startsWith(p)));
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Generate http-api with each cloud provider + default recipes
// ─────────────────────────────────────────────────────────────────────────

describe('Cloud provider + default recipes per provider', () => {
  const dirs = new Map<CloudProvider, string>();
  const registry = createRegistry();

  beforeAll(async () => {
    for (const provider of ['aws', 'gcp', 'azure', 'none'] as CloudProvider[]) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-cloud-${provider}-`));
      dirs.set(provider, dir);
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: provider,
        recipes: [...CLOUD_DEFAULTS[provider]],
      });
      await generate(config, registry, TEMPLATES_DIR);
    }
  });

  afterAll(() => {
    for (const dir of dirs.values()) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ── AWS ──

  describe('aws provider', () => {
    it('should include AWS SDK deps for aws-secrets-manager and aws-s3', () => {
      const pkg = readJson(dirs.get('aws')!, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@aws-sdk/client-secrets-manager']).toBeDefined();
      expect(deps['@aws-sdk/client-s3']).toBeDefined();
      expect(deps['@aws-sdk/s3-request-presigner']).toBeDefined();
    });

    it('should NOT include GCP deps', () => {
      const pkg = readJson(dirs.get('aws')!, 'package.json');
      const allDeps = depNames(pkg);
      expect(hasAnyPattern(allDeps, GCP_DEP_PATTERNS)).toBe(false);
    });

    it('should NOT include Azure deps', () => {
      const pkg = readJson(dirs.get('aws')!, 'package.json');
      const allDeps = depNames(pkg);
      expect(hasAnyPattern(allDeps, AZURE_DEP_PATTERNS)).toBe(false);
    });

    it('should have AWS_REGION in .env.example', () => {
      const envFile = readFile(dirs.get('aws')!, '.env.example');
      expect(envFile).toContain('AWS_REGION');
    });

    it('should have S3_BUCKET in .env.example', () => {
      const envFile = readFile(dirs.get('aws')!, '.env.example');
      expect(envFile).toContain('S3_BUCKET');
    });
  });

  // ── GCP ──

  describe('gcp provider', () => {
    it('should include GCP deps for gcp-secret-manager and gcp-cloud-storage', () => {
      const pkg = readJson(dirs.get('gcp')!, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@google-cloud/secret-manager']).toBeDefined();
      expect(deps['@google-cloud/storage']).toBeDefined();
    });

    it('should NOT include AWS deps', () => {
      const pkg = readJson(dirs.get('gcp')!, 'package.json');
      const allDeps = depNames(pkg);
      expect(hasAnyPattern(allDeps, AWS_DEP_PATTERNS)).toBe(false);
    });

    it('should NOT include Azure deps', () => {
      const pkg = readJson(dirs.get('gcp')!, 'package.json');
      const allDeps = depNames(pkg);
      expect(hasAnyPattern(allDeps, AZURE_DEP_PATTERNS)).toBe(false);
    });

    it('should have GCP_PROJECT_ID in .env.example', () => {
      const envFile = readFile(dirs.get('gcp')!, '.env.example');
      expect(envFile).toContain('GCP_PROJECT_ID');
    });

    it('should have GCS_BUCKET in .env.example', () => {
      const envFile = readFile(dirs.get('gcp')!, '.env.example');
      expect(envFile).toContain('GCS_BUCKET');
    });
  });

  // ── Azure ──

  describe('azure provider', () => {
    it('should include Azure deps for azure-key-vault and azure-blob-storage', () => {
      const pkg = readJson(dirs.get('azure')!, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@azure/keyvault-secrets']).toBeDefined();
      expect(deps['@azure/storage-blob']).toBeDefined();
      expect(deps['@azure/identity']).toBeDefined();
    });

    it('should NOT include AWS deps', () => {
      const pkg = readJson(dirs.get('azure')!, 'package.json');
      const allDeps = depNames(pkg);
      expect(hasAnyPattern(allDeps, AWS_DEP_PATTERNS)).toBe(false);
    });

    it('should NOT include GCP deps', () => {
      const pkg = readJson(dirs.get('azure')!, 'package.json');
      const allDeps = depNames(pkg);
      expect(hasAnyPattern(allDeps, GCP_DEP_PATTERNS)).toBe(false);
    });

    it('should have AZURE_KEY_VAULT_URL in .env.example', () => {
      const envFile = readFile(dirs.get('azure')!, '.env.example');
      expect(envFile).toContain('AZURE_KEY_VAULT_URL');
    });

    it('should have AZURE_STORAGE_ACCOUNT_NAME in .env.example', () => {
      const envFile = readFile(dirs.get('azure')!, '.env.example');
      expect(envFile).toContain('AZURE_STORAGE_ACCOUNT_NAME');
    });
  });

  // ── None ──

  describe('none provider', () => {
    it('should NOT include any cloud-specific deps', () => {
      const pkg = readJson(dirs.get('none')!, 'package.json');
      const allDeps = depNames(pkg);
      expect(hasAnyPattern(allDeps, AWS_DEP_PATTERNS)).toBe(false);
      expect(hasAnyPattern(allDeps, GCP_DEP_PATTERNS)).toBe(false);
      expect(hasAnyPattern(allDeps, AZURE_DEP_PATTERNS)).toBe(false);
    });

    it('should NOT have cloud-specific env vars in .env.example', () => {
      const envFile = readFile(dirs.get('none')!, '.env.example');
      expect(envFile).not.toContain('AWS_REGION');
      expect(envFile).not.toContain('GCP_PROJECT_ID');
      expect(envFile).not.toContain('AZURE_KEY_VAULT_URL');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 1b. Verify template files reference the correct cloud services
// ─────────────────────────────────────────────────────────────────────────

describe('Cloud recipe template files reference correct cloud services', () => {
  const dirs = new Map<CloudProvider, string>();
  const registry = createRegistry();

  beforeAll(async () => {
    for (const provider of ['aws', 'gcp', 'azure'] as CloudProvider[]) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-tpl-${provider}-`));
      dirs.set(provider, dir);
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: provider,
        recipes: [...CLOUD_DEFAULTS[provider]],
      });
      await generate(config, registry, TEMPLATES_DIR);
    }
  });

  afterAll(() => {
    for (const dir of dirs.values()) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('aws default recipes generate correct template files', () => {
    it('should create src/infrastructure/aws/secrets.service.ts', () => {
      const filePath = path.join(dirs.get('aws')!, 'src/infrastructure/aws/secrets.service.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('@aws-sdk/client-secrets-manager');
      expect(content).not.toContain('@google-cloud');
      expect(content).not.toContain('@azure');
    });

    it('should create src/infrastructure/aws/s3.service.ts', () => {
      const filePath = path.join(dirs.get('aws')!, 'src/infrastructure/aws/s3.service.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('@aws-sdk/client-s3');
      expect(content).toContain('S3Client');
      expect(content).not.toContain('@google-cloud');
      expect(content).not.toContain('@azure');
    });

    it('should NOT create any gcp or azure infrastructure directories', () => {
      const awsDir = dirs.get('aws')!;
      expect(fs.existsSync(path.join(awsDir, 'src/infrastructure/gcp'))).toBe(false);
      expect(fs.existsSync(path.join(awsDir, 'src/infrastructure/azure'))).toBe(false);
    });
  });

  describe('gcp default recipes generate correct template files', () => {
    it('should create src/infrastructure/gcp/secrets.service.ts', () => {
      const filePath = path.join(dirs.get('gcp')!, 'src/infrastructure/gcp/secrets.service.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('@google-cloud/secret-manager');
      expect(content).not.toContain('@aws-sdk');
      expect(content).not.toContain('@azure');
    });

    it('should create src/infrastructure/gcp/storage.service.ts', () => {
      const filePath = path.join(dirs.get('gcp')!, 'src/infrastructure/gcp/storage.service.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('@google-cloud/storage');
      expect(content).toContain('GcsStorageService');
      expect(content).not.toContain('@aws-sdk');
      expect(content).not.toContain('@azure');
    });

    it('should NOT create any aws or azure infrastructure directories', () => {
      const gcpDir = dirs.get('gcp')!;
      expect(fs.existsSync(path.join(gcpDir, 'src/infrastructure/aws'))).toBe(false);
      expect(fs.existsSync(path.join(gcpDir, 'src/infrastructure/azure'))).toBe(false);
    });
  });

  describe('azure default recipes generate correct template files', () => {
    it('should create src/infrastructure/azure/key-vault.service.ts', () => {
      const filePath = path.join(
        dirs.get('azure')!,
        'src/infrastructure/azure/key-vault.service.ts',
      );
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('@azure/keyvault-secrets');
      expect(content).not.toContain('@aws-sdk');
      expect(content).not.toContain('@google-cloud');
    });

    it('should create src/infrastructure/azure/blob-storage.service.ts', () => {
      const filePath = path.join(
        dirs.get('azure')!,
        'src/infrastructure/azure/blob-storage.service.ts',
      );
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('@azure/storage-blob');
      expect(content).toContain('BlobStorageService');
      expect(content).not.toContain('@aws-sdk');
      expect(content).not.toContain('@google-cloud');
    });

    it('should NOT create any aws or gcp infrastructure directories', () => {
      const azureDir = dirs.get('azure')!;
      expect(fs.existsSync(path.join(azureDir, 'src/infrastructure/aws'))).toBe(false);
      expect(fs.existsSync(path.join(azureDir, 'src/infrastructure/gcp'))).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Cross-cloud recipe misuse
//    Select a recipe from one cloud while cloudProvider is set to another.
//    The generator does NOT enforce cloud alignment — recipes are selected
//    by the user and the generator installs whatever is requested.
// ─────────────────────────────────────────────────────────────────────────

describe('Cross-cloud recipe misuse', () => {
  const registry = createRegistry();

  describe('aws-s3 recipe with cloudProvider: gcp', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cross-aws-gcp-'));
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: 'gcp',
        recipes: ['aws-s3'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should generate without error', () => {
      // If we reach here, generation succeeded
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    // BUG: The generator does not validate that cloud-specific recipes match the
    // selected cloudProvider. A user selecting aws-s3 with cloudProvider: 'gcp'
    // gets AWS SDK deps in a project tagged as GCP. The .spoonfeed.json manifest
    // says cloudProvider: 'gcp' but the project actually contains AWS dependencies.
    // There is no warning, error, or guard rail.
    it('should contain AWS deps despite cloudProvider being gcp (misalignment bug)', () => {
      const pkg = readJson(dir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      // AWS deps are present even though cloudProvider is gcp
      expect(deps['@aws-sdk/client-s3']).toBeDefined();
    });

    it('should record cloudProvider as gcp in manifest despite having AWS recipes', () => {
      const manifest = readJson(dir, '.spoonfeed.json');
      expect(manifest.cloudProvider).toBe('gcp');
      // BUG: Manifest says 'gcp' but aws-s3 recipe is installed — inconsistency.
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes['aws-s3']).toBeDefined();
    });
  });

  describe('azure-key-vault recipe with cloudProvider: aws', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cross-azure-aws-'));
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: 'aws',
        recipes: ['azure-key-vault'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should generate without error', () => {
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    // BUG: Same misalignment — Azure deps installed in an AWS-tagged project.
    it('should contain Azure deps despite cloudProvider being aws (misalignment bug)', () => {
      const pkg = readJson(dir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@azure/keyvault-secrets']).toBeDefined();
      expect(deps['@azure/identity']).toBeDefined();
    });

    it('should have AZURE_KEY_VAULT_URL in .env.example despite cloudProvider: aws', () => {
      const envFile = readFile(dir, '.env.example');
      expect(envFile).toContain('AZURE_KEY_VAULT_URL');
    });
  });

  describe('gcp-cloud-storage recipe with cloudProvider: azure', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cross-gcp-azure-'));
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: 'azure',
        recipes: ['gcp-cloud-storage'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should generate without error', () => {
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    // BUG: GCP deps installed in an Azure-tagged project.
    it('should contain GCP deps despite cloudProvider being azure (misalignment bug)', () => {
      const pkg = readJson(dir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@google-cloud/storage']).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Cloud provider 'none' with cloud recipes
// ─────────────────────────────────────────────────────────────────────────

describe("Cloud provider 'none' with cloud-specific recipes", () => {
  const registry = createRegistry();

  describe('aws-s3 with cloudProvider: none', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-none-aws-'));
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: 'none',
        recipes: ['aws-s3'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    // BUG: The generator silently allows cloud recipes when cloudProvider is 'none'.
    // No validation, no warning. The project will contain AWS deps but the manifest
    // says cloudProvider: 'none'.
    it('should generate without error (no validation)', () => {
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    it('should contain AWS deps despite cloudProvider: none', () => {
      const pkg = readJson(dir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@aws-sdk/client-s3']).toBeDefined();
    });

    it('should record cloudProvider as none in manifest', () => {
      const manifest = readJson(dir, '.spoonfeed.json');
      expect(manifest.cloudProvider).toBe('none');
    });
  });

  describe('gcp-cloud-logging with cloudProvider: none', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-none-gcp-'));
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: 'none',
        recipes: ['gcp-cloud-logging'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should generate without error (no validation)', () => {
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    it('should contain GCP deps despite cloudProvider: none', () => {
      const pkg = readJson(dir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@google-cloud/logging']).toBeDefined();
    });
  });

  describe('azure-blob-storage with cloudProvider: none', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-none-azure-'));
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: 'none',
        recipes: ['azure-blob-storage'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should generate without error (no validation)', () => {
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    it('should contain Azure deps despite cloudProvider: none', () => {
      const pkg = readJson(dir, 'package.json');
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@azure/storage-blob']).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. S3 env var collision: s3-minio + aws-s3
//    Both recipes define S3_BUCKET but with different defaults:
//    - s3-minio: S3_BUCKET=app-uploads
//    - aws-s3:   S3_BUCKET=my-bucket
// ─────────────────────────────────────────────────────────────────────────

describe('S3_BUCKET env var collision: s3-minio + aws-s3', () => {
  const registry = createRegistry();
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-s3-collision-'));
    const config = makeConfig({
      outputDir: dir,
      cloudProvider: 'aws',
      recipes: ['s3-minio', 'aws-s3'],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should generate without error', () => {
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
  });

  it('should have only one active S3_BUCKET entry in .env.example (deduped by seenKeys)', () => {
    const envFile = readFile(dir, '.env.example');
    const matches = envFile.match(/^S3_BUCKET=/gm);
    // Sections are now sorted alphabetically, so "AWS S3" comes before "S3 / MinIO
    // Storage". AWS S3 claims S3_BUCKET first. The s3-minio section still shows
    // S3_BUCKET but as a comment indicating it is shared with "AWS S3".
    expect(matches).toHaveLength(1);
  });

  it('should use the alphabetically-first section\'s default (AWS S3: my-bucket)', () => {
    const envFile = readFile(dir, '.env.example');
    // Sections are sorted alphabetically: "AWS S3" < "S3 / MinIO Storage".
    // AWS S3 claims S3_BUCKET first with its default value.
    expect(envFile).toContain('S3_BUCKET=my-bucket');
    // The s3-minio S3_BUCKET appears as a comment indicating the shared dependency
    expect(envFile).toContain('# S3_BUCKET=app-uploads (shared with AWS S3)');
  });

  it('should have @aws-sdk/client-s3 from both recipes (same version, no conflict)', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    // Both s3-minio and aws-s3 declare the same @aws-sdk/client-s3 version,
    // so package-json-merger merges them without issue (last-write-wins, same value).
    expect(deps['@aws-sdk/client-s3']).toBe('3.712.0');
  });

  it('should place S3_BUCKET in the alphabetically-first section (AWS S3) and show it as a comment in s3-minio', () => {
    const envFile = readFile(dir, '.env.example');
    // Both sections are always present
    expect(envFile).toContain('--- S3 / MinIO Storage ---');
    expect(envFile).toContain('--- AWS S3 ---');

    // AWS S3 comes first alphabetically and claims S3_BUCKET as an active entry
    const awsS3Match = envFile.match(/# --- AWS S3 ---\n([\s\S]*?)# --- end AWS S3 ---/);
    expect(awsS3Match).not.toBeNull();
    expect(awsS3Match![1]).toContain('S3_BUCKET=my-bucket');

    // s3-minio section shows S3_BUCKET as a comment since it was already claimed
    const minioMatch = envFile.match(
      /# --- S3 \/ MinIO Storage ---\n([\s\S]*?)# --- end S3 \/ MinIO Storage ---/,
    );
    expect(minioMatch).not.toBeNull();
    expect(minioMatch![1]).toContain('# S3_BUCKET=app-uploads (shared with AWS S3)');
  });

  it('both recipes share @aws-sdk/s3-request-presigner without conflict', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@aws-sdk/s3-request-presigner']).toBe('3.712.0');
  });
});

describe('S3_BUCKET env var collision: reverse order (aws-s3 before s3-minio)', () => {
  const registry = createRegistry();
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-s3-reverse-'));
    const config = makeConfig({
      outputDir: dir,
      cloudProvider: 'aws',
      // Note: aws-s3 listed FIRST this time (opposite of previous test)
      recipes: ['aws-s3', 's3-minio'],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should generate without error', () => {
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
  });

  // Sections are now sorted alphabetically regardless of config.recipes order.
  // "AWS S3" < "S3 / MinIO Storage", so AWS S3 always claims S3_BUCKET first.
  // The result is identical to the forward-order test above.
  it('should use AWS S3 default (my-bucket) since sections are sorted alphabetically', () => {
    const envFile = readFile(dir, '.env.example');
    const matches = envFile.match(/^S3_BUCKET=/gm);
    expect(matches).toHaveLength(1);
    expect(envFile).toContain('S3_BUCKET=my-bucket');
    // The s3-minio S3_BUCKET appears as a comment, not an active entry
    expect(envFile).toContain('# S3_BUCKET=app-uploads (shared with AWS S3)');
  });

  it('s3-minio section should show S3_BUCKET as a shared-with comment', () => {
    const envFile = readFile(dir, '.env.example');
    const minioMatch = envFile.match(
      /# --- S3 \/ MinIO Storage ---\n([\s\S]*?)# --- end S3 \/ MinIO Storage ---/,
    );
    expect(minioMatch).not.toBeNull();
    // S3_BUCKET appears as a comment noting it is shared with the AWS S3 section
    expect(minioMatch![1]).toContain('# S3_BUCKET=app-uploads (shared with AWS S3)');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. All cloud-specific recipes per provider
// ─────────────────────────────────────────────────────────────────────────

describe('All AWS recipes together', () => {
  const registry = createRegistry();
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-all-aws-'));
    const config = makeConfig({
      outputDir: dir,
      cloudProvider: 'aws',
      recipes: [...AWS_RECIPES],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should generate without error', () => {
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
  });

  it('should contain deps from all 12 AWS recipes', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    // Spot-check key deps from various AWS recipes
    expect(deps['@aws-sdk/client-sqs']).toBeDefined();
    expect(deps['@aws-sdk/client-sns']).toBeDefined();
    expect(deps['@aws-sdk/client-eventbridge']).toBeDefined();
    expect(deps['@aws-sdk/client-secrets-manager']).toBeDefined();
    expect(deps['@aws-sdk/client-ssm']).toBeDefined();
    expect(deps['@aws-sdk/client-s3']).toBeDefined();
    expect(deps['@aws-sdk/client-cognito-identity-provider']).toBeDefined();
    expect(deps['@aws-sdk/client-cloudwatch-logs']).toBeDefined();
    expect(deps['@aws-sdk/client-dynamodb']).toBeDefined();
    expect(deps['@aws-sdk/client-cloudfront']).toBeDefined();
    expect(deps['ioredis']).toBeDefined(); // aws-elasticache
    expect(deps['aws-jwt-verify']).toBeDefined(); // aws-cognito
  });

  it('should NOT have GCP or Azure deps', () => {
    const pkg = readJson(dir, 'package.json');
    const allDeps = depNames(pkg);
    expect(hasAnyPattern(allDeps, GCP_DEP_PATTERNS)).toBe(false);
    expect(hasAnyPattern(allDeps, AZURE_DEP_PATTERNS)).toBe(false);
  });

  it('should have AWS_REGION appear once as an active entry in .env.example (deduped)', () => {
    const envFile = readFile(dir, '.env.example');
    const matches = envFile.match(/^AWS_REGION=/gm);
    // Sections are sorted alphabetically. The first section alphabetically that
    // declares AWS_REGION claims it as an active entry. All subsequent sections
    // show it as a "shared with ..." comment instead of silently dropping it.
    expect(matches).toHaveLength(1);
  });

  it('should have separate .env sections for every AWS recipe (including those with only shared vars)', () => {
    const envFile = readFile(dir, '.env.example');
    // Sections are now sorted alphabetically and always present, even when all
    // of a section's vars were deduped (they appear as shared-with comments).
    expect(envFile).toContain('--- AWS CloudFront ---');
    expect(envFile).toContain('--- AWS CloudWatch Logs ---');
    expect(envFile).toContain('--- AWS Cognito ---');
    expect(envFile).toContain('--- AWS DynamoDB ---');
    expect(envFile).toContain('--- AWS ElastiCache ---');
    expect(envFile).toContain('--- AWS EventBridge ---');
    expect(envFile).toContain('--- AWS RDS ---');
    expect(envFile).toContain('--- AWS S3 ---');
    // aws-secrets-manager now appears even though its only var (AWS_REGION) is
    // shared — the section marker is always written, and the var shows as a comment.
    expect(envFile).toContain('--- AWS Secrets Manager ---');
    expect(envFile).toContain('--- AWS SNS ---');
    expect(envFile).toContain('--- AWS SQS ---');
    expect(envFile).toContain('--- AWS SSM Parameter Store ---');
  });

  it('aws-rds includes TypeORM deps (potential conflict if typeorm-postgres also selected)', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    // aws-rds adds @nestjs/typeorm, typeorm, pg — same packages as typeorm-postgres.
    // No conflict declared between them in recipe definitions, even though they install
    // the same core dependencies. The last-write-wins merge in package-json-merger
    // makes this harmless (same versions), but it's conceptually odd.
    expect(deps['@nestjs/typeorm']).toBeDefined();
    expect(deps['typeorm']).toBeDefined();
    expect(deps['pg']).toBeDefined();
  });
});

describe('All GCP recipes together', () => {
  const registry = createRegistry();
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-all-gcp-'));
    const config = makeConfig({
      outputDir: dir,
      cloudProvider: 'gcp',
      recipes: [...GCP_RECIPES],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should generate without error', () => {
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
  });

  it('should contain deps from all 10 GCP recipes', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@google-cloud/pubsub']).toBeDefined();
    expect(deps['@google-cloud/secret-manager']).toBeDefined();
    expect(deps['@google-cloud/storage']).toBeDefined();
    expect(deps['@google-cloud/functions-framework']).toBeDefined();
    expect(deps['firebase-admin']).toBeDefined();
    expect(deps['@google-cloud/logging']).toBeDefined();
    expect(deps['@google-cloud/firestore']).toBeDefined();
    expect(deps['ioredis']).toBeDefined(); // gcp-memorystore
  });

  it('should NOT have AWS or Azure deps', () => {
    const pkg = readJson(dir, 'package.json');
    const allDeps = depNames(pkg);
    expect(hasAnyPattern(allDeps, AWS_DEP_PATTERNS)).toBe(false);
    expect(hasAnyPattern(allDeps, AZURE_DEP_PATTERNS)).toBe(false);
  });

  it('should have GCP_PROJECT_ID appear once in .env.example (deduped)', () => {
    const envFile = readFile(dir, '.env.example');
    const matches = envFile.match(/^GCP_PROJECT_ID=/gm);
    // BUG: Same dedup issue as AWS_REGION — GCP_PROJECT_ID is shared across
    // pubsub, secret-manager, cloud-storage, cloud-functions, firebase-auth,
    // cloud-logging, cloud-sql, firestore, memorystore, cloud-cdn.
    // Only the first recipe's (gcp-pubsub) section includes it.
    expect(matches).toHaveLength(1);
  });

  it('gcp-cloud-sql includes TypeORM deps (same as aws-rds pattern)', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/typeorm']).toBeDefined();
    expect(deps['typeorm']).toBeDefined();
    expect(deps['pg']).toBeDefined();
  });
});

describe('All Azure recipes together', () => {
  const registry = createRegistry();
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-all-azure-'));
    const config = makeConfig({
      outputDir: dir,
      cloudProvider: 'azure',
      recipes: [...AZURE_RECIPES],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should generate without error', () => {
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
  });

  it('should contain deps from all 10 Azure recipes', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@azure/service-bus']).toBeDefined();
    expect(deps['@azure/keyvault-secrets']).toBeDefined();
    expect(deps['@azure/storage-blob']).toBeDefined();
    expect(deps['@azure/functions']).toBeDefined();
    expect(deps['@azure/msal-node']).toBeDefined(); // azure-entra-id
    expect(deps['applicationinsights']).toBeDefined(); // azure-app-insights
    expect(deps['@azure/cosmos']).toBeDefined();
    expect(deps['mssql']).toBeDefined(); // azure-sql-database
    expect(deps['ioredis']).toBeDefined(); // azure-cache
  });

  it('should NOT have AWS or GCP deps', () => {
    const pkg = readJson(dir, 'package.json');
    const allDeps = depNames(pkg);
    expect(hasAnyPattern(allDeps, AWS_DEP_PATTERNS)).toBe(false);
    expect(hasAnyPattern(allDeps, GCP_DEP_PATTERNS)).toBe(false);
  });

  it('@azure/identity should appear once despite multiple recipes requiring it', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    // azure-service-bus, azure-key-vault, azure-blob-storage, azure-entra-id, azure-cosmos-db
    // all require @azure/identity. package-json-merger's last-write-wins means the version
    // from the last recipe (azure-cosmos-db) is what lands in package.json.
    // Since all versions are the same (4.5.0), this is not a problem in practice.
    expect(deps['@azure/identity']).toBe('4.5.0');
  });

  it('azure-sql-database includes TypeORM deps', () => {
    const pkg = readJson(dir, 'package.json');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/typeorm']).toBeDefined();
    expect(deps['typeorm']).toBeDefined();
    expect(deps['mssql']).toBeDefined();
  });

  it('should have separate .env sections for each Azure recipe', () => {
    const envFile = readFile(dir, '.env.example');
    expect(envFile).toContain('--- Azure Service Bus ---');
    expect(envFile).toContain('--- Azure Key Vault ---');
    expect(envFile).toContain('--- Azure Blob Storage ---');
    expect(envFile).toContain('--- Azure Functions ---');
    expect(envFile).toContain('--- Azure Entra ID ---');
    expect(envFile).toContain('--- Azure Application Insights ---');
    expect(envFile).toContain('--- Azure Cosmos DB ---');
    expect(envFile).toContain('--- Azure SQL Database ---');
    expect(envFile).toContain('--- Azure Cache for Redis ---');
    expect(envFile).toContain('--- Azure Front Door ---');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Edge case: mixing cloud recipes from all three providers
// ─────────────────────────────────────────────────────────────────────────

describe('Mixed cloud recipes: one from each provider', () => {
  const registry = createRegistry();
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-multi-cloud-'));
    const config = makeConfig({
      outputDir: dir,
      cloudProvider: 'none',
      recipes: ['aws-s3', 'gcp-cloud-storage', 'azure-blob-storage'],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // BUG: The generator allows mixing recipes from all three cloud providers
  // with cloudProvider: 'none'. The resulting project is a multi-cloud chimera
  // with deps from AWS, GCP, and Azure — all while the manifest says 'none'.
  it('should generate without error (no multi-cloud guard)', () => {
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
  });

  it('should contain deps from all three cloud providers', () => {
    const pkg = readJson(dir, 'package.json');
    const allDeps = depNames(pkg);
    expect(hasAnyPattern(allDeps, AWS_DEP_PATTERNS)).toBe(true);
    expect(hasAnyPattern(allDeps, GCP_DEP_PATTERNS)).toBe(true);
    expect(hasAnyPattern(allDeps, AZURE_DEP_PATTERNS)).toBe(true);
  });

  it('should have env vars from all three clouds', () => {
    const envFile = readFile(dir, '.env.example');
    // AWS
    expect(envFile).toContain('AWS_REGION');
    expect(envFile).toContain('S3_BUCKET');
    // GCP
    expect(envFile).toContain('GCP_PROJECT_ID');
    expect(envFile).toContain('GCS_BUCKET');
    // Azure
    expect(envFile).toContain('AZURE_STORAGE_ACCOUNT_NAME');
  });

  it('manifest says cloudProvider: none despite having all three clouds', () => {
    const manifest = readJson(dir, '.spoonfeed.json');
    // BUG: The manifest does not reflect actual cloud usage.
    expect(manifest.cloudProvider).toBe('none');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Edge case: cloud recipes with zero runtime dependencies
//   gcp-cloud-cdn and azure-front-door have empty dependencies objects.
//   They contribute only env vars and template files.
// ─────────────────────────────────────────────────────────────────────────

describe('Cloud recipes with no runtime dependencies', () => {
  const registry = createRegistry();

  describe('gcp-cloud-cdn alone', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cdn-gcp-'));
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: 'gcp',
        recipes: ['gcp-cloud-cdn'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should generate without error', () => {
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    it('should have NO cloud-specific runtime deps (gcp-cloud-cdn has empty deps)', () => {
      const pkg = readJson(dir, 'package.json');
      const allDeps = depNames(pkg);
      // gcp-cloud-cdn has dependencies: {}, so no cloud libs are added
      expect(hasAnyPattern(allDeps, GCP_DEP_PATTERNS)).toBe(false);
      expect(hasAnyPattern(allDeps, AWS_DEP_PATTERNS)).toBe(false);
      expect(hasAnyPattern(allDeps, AZURE_DEP_PATTERNS)).toBe(false);
    });

    it('should still have CDN env vars in .env.example', () => {
      const envFile = readFile(dir, '.env.example');
      expect(envFile).toContain('GCP_PROJECT_ID');
      expect(envFile).toContain('CDN_SIGNING_KEY_NAME');
      expect(envFile).toContain('CDN_SIGNING_KEY');
    });

    it('should record gcp-cloud-cdn in manifest', () => {
      const manifest = readJson(dir, '.spoonfeed.json');
      const recipes = manifest.recipes as Record<string, unknown>;
      expect(recipes['gcp-cloud-cdn']).toBeDefined();
    });
  });

  describe('azure-front-door alone', () => {
    let dir: string;

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-fd-azure-'));
      const config = makeConfig({
        outputDir: dir,
        cloudProvider: 'azure',
        recipes: ['azure-front-door'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('should generate without error', () => {
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    });

    it('should have NO cloud-specific runtime deps (azure-front-door has empty deps)', () => {
      const pkg = readJson(dir, 'package.json');
      const allDeps = depNames(pkg);
      expect(hasAnyPattern(allDeps, AZURE_DEP_PATTERNS)).toBe(false);
      expect(hasAnyPattern(allDeps, AWS_DEP_PATTERNS)).toBe(false);
      expect(hasAnyPattern(allDeps, GCP_DEP_PATTERNS)).toBe(false);
    });

    it('should still have Front Door env vars in .env.example', () => {
      const envFile = readFile(dir, '.env.example');
      expect(envFile).toContain('AZURE_FRONTDOOR_HOSTNAME');
      expect(envFile).toContain('AZURE_FRONTDOOR_HEADER');
      expect(envFile).toContain('AZURE_FRONTDOOR_ID');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Edge case: cross-cloud misuse also creates wrong template directories
// ─────────────────────────────────────────────────────────────────────────

describe('Cross-cloud misuse: template directories from wrong cloud appear in output', () => {
  const registry = createRegistry();
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cross-tpl-'));
    const config = makeConfig({
      outputDir: dir,
      cloudProvider: 'gcp',
      recipes: ['aws-s3', 'azure-key-vault'],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // BUG: When selecting recipes from the wrong cloud, their template files are still
  // copied into the project, creating infrastructure directories for clouds that
  // don't match the cloudProvider setting. The project ends up with
  // src/infrastructure/aws/ and src/infrastructure/azure/ even though
  // cloudProvider is 'gcp'.
  it('should create src/infrastructure/aws/ despite cloudProvider: gcp', () => {
    expect(fs.existsSync(path.join(dir, 'src/infrastructure/aws'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/infrastructure/aws/s3.service.ts'))).toBe(true);
  });

  it('should create src/infrastructure/azure/ despite cloudProvider: gcp', () => {
    expect(fs.existsSync(path.join(dir, 'src/infrastructure/azure'))).toBe(true);
    expect(
      fs.existsSync(path.join(dir, 'src/infrastructure/azure/key-vault.service.ts')),
    ).toBe(true);
  });

  it('should NOT have any src/infrastructure/gcp/ directory (no GCP recipes selected)', () => {
    expect(fs.existsSync(path.join(dir, 'src/infrastructure/gcp'))).toBe(false);
  });

  it('manifest says gcp but recipe files are all from aws and azure', () => {
    const manifest = readJson(dir, '.spoonfeed.json');
    expect(manifest.cloudProvider).toBe('gcp');
    const recipes = manifest.recipes as Record<string, unknown>;
    expect(recipes['aws-s3']).toBeDefined();
    expect(recipes['azure-key-vault']).toBeDefined();
  });
});
