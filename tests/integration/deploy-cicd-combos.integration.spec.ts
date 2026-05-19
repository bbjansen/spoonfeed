import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import {
  DEPLOYMENT_TARGETS,
  CI_CD_PROVIDERS,
  HTTP_ADAPTERS,
} from '@spoonfeed/types';
import type {
  ProjectConfig,
  DeploymentTarget,
  CiCdProvider,
  HttpAdapter,
} from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: 'deploy-test-project',
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

function fileExists(outputDir: string, filePath: string): boolean {
  return fs.existsSync(path.join(outputDir, filePath));
}

function readFile(outputDir: string, filePath: string): string {
  return fs.readFileSync(path.join(outputDir, filePath), 'utf-8');
}

/**
 * Check that a file contains no leftover EJS tags.
 * Returns an array of violations (line number + content) for debugging.
 */
function findEjsResidues(content: string, filePath: string): string[] {
  const violations: string[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match EJS output tags like <%= ... %> or <%- ... %> or control tags <% ... %>
    // but exclude ${...} which is YAML/shell variable substitution, not EJS
    if (/<%[=\-]?\s/.test(line) || /\s%>/.test(line)) {
      violations.push(`${filePath}:${i + 1}: ${line.trim()}`);
    }
  }
  return violations;
}

/**
 * Recursively read all files in a directory and return their paths + contents.
 */
function readAllFiles(dir: string, base?: string): Array<{ relative: string; content: string }> {
  const root = base ?? dir;
  const results: Array<{ relative: string; content: string }> = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...readAllFiles(fullPath, root));
    } else {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        results.push({ relative: path.relative(root, fullPath), content });
      } catch {
        // Skip binary files
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Section 1: Template directory existence
// ---------------------------------------------------------------------------
describe('Template directory existence', () => {
  it('every DEPLOYMENT_TARGETS entry has a corresponding template directory', () => {
    const missing: string[] = [];
    for (const target of DEPLOYMENT_TARGETS) {
      const dir = path.join(TEMPLATES_DIR, 'recipes', 'deploy', target);
      if (!fs.existsSync(dir)) {
        missing.push(target);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every CI_CD_PROVIDERS entry has a corresponding template directory', () => {
    const missing: string[] = [];
    for (const provider of CI_CD_PROVIDERS) {
      const dir = path.join(TEMPLATES_DIR, 'recipes', 'ci-cd', provider);
      if (!fs.existsSync(dir)) {
        missing.push(provider);
      }
    }
    expect(missing).toEqual([]);
  });

  it('deploy template directories contain at least one non-README file', () => {
    const empty: string[] = [];
    for (const target of DEPLOYMENT_TARGETS) {
      const dir = path.join(TEMPLATES_DIR, 'recipes', 'deploy', target);
      if (!fs.existsSync(dir)) continue;
      const files = readAllFiles(dir).filter((f) => !f.relative.endsWith('README.md'));
      if (files.length === 0) {
        empty.push(target);
      }
    }
    expect(empty).toEqual([]);
  });

  it('ci-cd template directories contain at least one non-README file', () => {
    const empty: string[] = [];
    for (const provider of CI_CD_PROVIDERS) {
      const dir = path.join(TEMPLATES_DIR, 'recipes', 'ci-cd', provider);
      if (!fs.existsSync(dir)) continue;
      const files = readAllFiles(dir).filter((f) => !f.relative.endsWith('README.md'));
      if (files.length === 0) {
        empty.push(provider);
      }
    }
    expect(empty).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Section 2: Individual deployment targets (both adapters)
// ---------------------------------------------------------------------------
describe('Individual deployment targets for http-api', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe.each(HTTP_ADAPTERS.map((a) => [a]))('adapter: %s', (adapter: string) => {
    // ── dockerfile ──
    describe('dockerfile', () => {
      let outputDir: string;

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-dockerfile-'));
        const config = makeConfig({
          outputDir,
          httpAdapter: adapter as HttpAdapter,
          deploymentTargets: ['dockerfile'],
        });
        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('creates Dockerfile', () => {
        expect(fileExists(outputDir, 'Dockerfile')).toBe(true);
      });

      it('creates .dockerignore (from dot-dockerignore)', () => {
        expect(fileExists(outputDir, '.dockerignore')).toBe(true);
      });

      it('Dockerfile exposes port 3000', () => {
        const dockerfile = readFile(outputDir, 'Dockerfile');
        expect(dockerfile).toMatch(/EXPOSE\s+3000/);
      });

      it('Dockerfile has no leftover EJS tags', () => {
        const dockerfile = readFile(outputDir, 'Dockerfile');
        const residues = findEjsResidues(dockerfile, 'Dockerfile');
        expect(residues).toEqual([]);
      });

      it('.dockerignore has no leftover EJS tags', () => {
        const dockerignore = readFile(outputDir, '.dockerignore');
        const residues = findEjsResidues(dockerignore, '.dockerignore');
        expect(residues).toEqual([]);
      });
    });

    // ── docker-compose ──
    describe('docker-compose', () => {
      let outputDir: string;

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-compose-'));
        const config = makeConfig({
          outputDir,
          httpAdapter: adapter as HttpAdapter,
          deploymentTargets: ['docker-compose'],
        });
        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('creates docker-compose.yml', () => {
        expect(fileExists(outputDir, 'docker-compose.yml')).toBe(true);
      });

      it('docker-compose.yml maps port 3000', () => {
        const compose = readFile(outputDir, 'docker-compose.yml');
        expect(compose).toContain('3000');
      });

      it('docker-compose.yml has no leftover EJS tags', () => {
        const compose = readFile(outputDir, 'docker-compose.yml');
        const residues = findEjsResidues(compose, 'docker-compose.yml');
        expect(residues).toEqual([]);
      });
    });

    // ── kubernetes ──
    describe('kubernetes', () => {
      let outputDir: string;

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-k8s-'));
        const config = makeConfig({
          outputDir,
          httpAdapter: adapter as HttpAdapter,
          deploymentTargets: ['kubernetes'],
        });
        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('creates k8s/deployment.yaml', () => {
        expect(fileExists(outputDir, 'k8s/deployment.yaml')).toBe(true);
      });

      it('creates k8s/service.yaml', () => {
        expect(fileExists(outputDir, 'k8s/service.yaml')).toBe(true);
      });

      it('creates k8s/configmap.yaml', () => {
        expect(fileExists(outputDir, 'k8s/configmap.yaml')).toBe(true);
      });

      it('creates k8s/ingress.yaml', () => {
        expect(fileExists(outputDir, 'k8s/ingress.yaml')).toBe(true);
      });

      it('creates k8s/hpa.yaml', () => {
        expect(fileExists(outputDir, 'k8s/hpa.yaml')).toBe(true);
      });

      it('deployment.yaml references containerPort 3000', () => {
        const deployment = readFile(outputDir, 'k8s/deployment.yaml');
        expect(deployment).toContain('containerPort: 3000');
      });

      it('service.yaml targets port 3000', () => {
        const service = readFile(outputDir, 'k8s/service.yaml');
        expect(service).toContain('targetPort: 3000');
      });

      it('k8s manifests have no leftover EJS tags', () => {
        const k8sFiles = ['deployment.yaml', 'service.yaml', 'configmap.yaml', 'ingress.yaml', 'hpa.yaml'];
        const residues: string[] = [];
        for (const file of k8sFiles) {
          const filePath = `k8s/${file}`;
          if (fileExists(outputDir, filePath)) {
            const content = readFile(outputDir, filePath);
            residues.push(...findEjsResidues(content, filePath));
          }
        }
        expect(residues).toEqual([]);
      });

      it('kubernetes manifests use the project name from config', () => {
        const deployment = readFile(outputDir, 'k8s/deployment.yaml');
        // K8s templates are now .ejs and use <%= name %> for metadata
        expect(deployment).toContain('name: deploy-test-project');
        expect(deployment).toContain('app: deploy-test-project');
      });
    });

    // ── serverless-framework ──
    describe('serverless-framework', () => {
      let outputDir: string;

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-sls-'));
        const config = makeConfig({
          outputDir,
          httpAdapter: adapter as HttpAdapter,
          deploymentTargets: ['serverless-framework'],
        });
        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('creates serverless.yml', () => {
        expect(fileExists(outputDir, 'serverless.yml')).toBe(true);
      });

      it('serverless.yml references the project name', () => {
        const sls = readFile(outputDir, 'serverless.yml');
        expect(sls).toContain('deploy-test-project');
      });

      it('serverless.yml has no leftover EJS tags', () => {
        const sls = readFile(outputDir, 'serverless.yml');
        const residues = findEjsResidues(sls, 'serverless.yml');
        expect(residues).toEqual([]);
      });

      it('serverless.yml uses provider aws', () => {
        const sls = readFile(outputDir, 'serverless.yml');
        expect(sls).toContain('name: aws');
      });
    });

    // ── terraform ──
    describe('terraform', () => {
      let outputDir: string;

      beforeAll(async () => {
        outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-tf-'));
        const config = makeConfig({
          outputDir,
          httpAdapter: adapter as HttpAdapter,
          deploymentTargets: ['terraform'],
        });
        await generate(config, registry, TEMPLATES_DIR);
      });

      afterAll(() => {
        fs.rmSync(outputDir, { recursive: true, force: true });
      });

      it('creates main.tf', () => {
        expect(fileExists(outputDir, 'main.tf')).toBe(true);
      });

      it('creates variables.tf', () => {
        expect(fileExists(outputDir, 'variables.tf')).toBe(true);
      });

      it('creates outputs.tf', () => {
        expect(fileExists(outputDir, 'outputs.tf')).toBe(true);
      });

      it('creates modules/app/ directory with terraform files', () => {
        expect(fileExists(outputDir, 'modules/app/main.tf')).toBe(true);
        expect(fileExists(outputDir, 'modules/app/variables.tf')).toBe(true);
        expect(fileExists(outputDir, 'modules/app/outputs.tf')).toBe(true);
      });

      it('main.tf references the project name', () => {
        const mainTf = readFile(outputDir, 'main.tf');
        expect(mainTf).toContain('deploy-test-project');
      });

      it('terraform files have no leftover EJS tags', () => {
        const tfFiles = readAllFiles(outputDir).filter(
          (f) => f.relative.endsWith('.tf') || f.relative.endsWith('.tf.json'),
        );
        const residues: string[] = [];
        for (const file of tfFiles) {
          residues.push(...findEjsResidues(file.content, file.relative));
        }
        expect(residues).toEqual([]);
      });

      // BUG: terraform main.tf hardcodes `backend "s3" {}` which is AWS-specific.
      // When the cloudProvider is 'gcp' or 'azure', this is incorrect.
      // The template is an .ejs file but does not use any conditional logic
      // based on cloudProvider to switch between s3/gcs/azurerm backends.
      it('terraform main.tf hardcodes AWS S3 backend regardless of cloudProvider (documents known issue)', () => {
        const mainTf = readFile(outputDir, 'main.tf');
        expect(mainTf).toContain('backend "s3"');
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Section 3: All deployment targets at once (no file conflicts)
// ---------------------------------------------------------------------------
describe('All deployment targets combined', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-all-'));
    const config = makeConfig({
      outputDir,
      deploymentTargets: [...DEPLOYMENT_TARGETS],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('generates without error', () => {
    // If we got here, generation succeeded
    expect(fileExists(outputDir, 'package.json')).toBe(true);
  });

  it('Dockerfile exists', () => {
    expect(fileExists(outputDir, 'Dockerfile')).toBe(true);
  });

  it('docker-compose.yml exists', () => {
    expect(fileExists(outputDir, 'docker-compose.yml')).toBe(true);
  });

  it('k8s manifests exist', () => {
    expect(fileExists(outputDir, 'k8s/deployment.yaml')).toBe(true);
  });

  it('serverless.yml exists', () => {
    expect(fileExists(outputDir, 'serverless.yml')).toBe(true);
  });

  it('main.tf exists', () => {
    expect(fileExists(outputDir, 'main.tf')).toBe(true);
  });

  it('no files contain leftover EJS tags', () => {
    const allFiles = readAllFiles(outputDir);
    const residues: string[] = [];
    for (const file of allFiles) {
      // Skip node_modules, binary files, and .spoonfeed.json
      if (file.relative.startsWith('node_modules')) continue;
      residues.push(...findEjsResidues(file.content, file.relative));
    }
    expect(residues).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Section 4: CI/CD providers
// ---------------------------------------------------------------------------
describe('Individual CI/CD providers for http-api', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('github-actions', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cicd-gh-'));
      const config = makeConfig({
        outputDir,
        ciCdProvider: 'github-actions',
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('creates .github/workflows/ci.yml', () => {
      expect(fileExists(outputDir, '.github/workflows/ci.yml')).toBe(true);
    });

    it('creates .github/workflows/cd.yml', () => {
      expect(fileExists(outputDir, '.github/workflows/cd.yml')).toBe(true);
    });

    it('ci.yml references pnpm commands', () => {
      const ci = readFile(outputDir, '.github/workflows/ci.yml');
      expect(ci).toContain('pnpm install');
      expect(ci).toContain('pnpm build');
    });

    it('ci.yml has no leftover EJS tags', () => {
      const ci = readFile(outputDir, '.github/workflows/ci.yml');
      const residues = findEjsResidues(ci, '.github/workflows/ci.yml');
      expect(residues).toEqual([]);
    });

    it('cd.yml has no leftover EJS tags', () => {
      const cd = readFile(outputDir, '.github/workflows/cd.yml');
      const residues = findEjsResidues(cd, '.github/workflows/cd.yml');
      expect(residues).toEqual([]);
    });
  });

  describe('azure-devops', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cicd-azdo-'));
      const config = makeConfig({
        outputDir,
        ciCdProvider: 'azure-devops',
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('creates azure-pipelines.yml', () => {
      expect(fileExists(outputDir, 'azure-pipelines.yml')).toBe(true);
    });

    it('azure-pipelines.yml references pnpm commands', () => {
      const pipeline = readFile(outputDir, 'azure-pipelines.yml');
      expect(pipeline).toContain('pnpm install');
      expect(pipeline).toContain('pnpm build');
    });

    it('azure-pipelines.yml has no leftover EJS tags', () => {
      const pipeline = readFile(outputDir, 'azure-pipelines.yml');
      const residues = findEjsResidues(pipeline, 'azure-pipelines.yml');
      expect(residues).toEqual([]);
    });
  });

  describe('aws-codepipeline', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cicd-awscp-'));
      const config = makeConfig({
        outputDir,
        ciCdProvider: 'aws-codepipeline',
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('creates buildspec.yml', () => {
      expect(fileExists(outputDir, 'buildspec.yml')).toBe(true);
    });

    it('buildspec.yml references pnpm commands', () => {
      const buildspec = readFile(outputDir, 'buildspec.yml');
      expect(buildspec).toContain('pnpm install');
      expect(buildspec).toContain('pnpm build');
    });

    it('buildspec.yml has no leftover EJS tags', () => {
      const buildspec = readFile(outputDir, 'buildspec.yml');
      const residues = findEjsResidues(buildspec, 'buildspec.yml');
      expect(residues).toEqual([]);
    });
  });

  describe('gcp-cloudbuild', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cicd-gcpb-'));
      const config = makeConfig({
        outputDir,
        ciCdProvider: 'gcp-cloudbuild',
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('creates cloudbuild.yaml', () => {
      expect(fileExists(outputDir, 'cloudbuild.yaml')).toBe(true);
    });

    it('cloudbuild.yaml references pnpm commands', () => {
      const cb = readFile(outputDir, 'cloudbuild.yaml');
      expect(cb).toContain('pnpm install');
      expect(cb).toContain('pnpm build');
    });

    it('cloudbuild.yaml has no leftover EJS tags', () => {
      const cb = readFile(outputDir, 'cloudbuild.yaml');
      const residues = findEjsResidues(cb, 'cloudbuild.yaml');
      expect(residues).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Section 5: Deployment + project type interactions
// ---------------------------------------------------------------------------
describe('Deployment + project type interactions', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('serverless-framework with aws-lambda', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-sls-lambda-'));
      const config = makeConfig({
        outputDir,
        projectType: 'aws-lambda',
        cloudProvider: 'aws',
        deploymentTargets: ['serverless-framework'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'package.json')).toBe(true);
    });

    it('creates serverless.yml', () => {
      expect(fileExists(outputDir, 'serverless.yml')).toBe(true);
    });

    it('main.ts has a lambda handler export', () => {
      const mainTs = readFile(outputDir, 'src/main.ts');
      expect(mainTs).toContain('handler');
    });

    it('serverless.yml handler path points to dist/main.handler', () => {
      const sls = readFile(outputDir, 'serverless.yml');
      expect(sls).toContain('dist/main.handler');
    });

    it('serverless.yml service name matches project name', () => {
      const sls = readFile(outputDir, 'serverless.yml');
      expect(sls).toContain('deploy-test-project');
    });
  });

  describe('kubernetes with monorepo', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-k8s-monorepo-'));
      const config = makeConfig({
        outputDir,
        projectType: 'monorepo',
        deploymentTargets: ['kubernetes'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'package.json')).toBe(true);
    });

    it('creates k8s manifests', () => {
      expect(fileExists(outputDir, 'k8s/deployment.yaml')).toBe(true);
      expect(fileExists(outputDir, 'k8s/service.yaml')).toBe(true);
    });

    it('NestJS source is under apps/api/', () => {
      expect(fileExists(outputDir, 'apps/api/src/main.ts')).toBe(true);
    });

  });

  describe('dockerfile with full-stack', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-docker-fullstack-'));
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        deploymentTargets: ['dockerfile'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'package.json')).toBe(true);
    });

    it('creates Dockerfile', () => {
      expect(fileExists(outputDir, 'Dockerfile')).toBe(true);
    });

    it('creates apps/api/ and apps/web/ directories', () => {
      expect(fileExists(outputDir, 'apps/api/src/main.ts')).toBe(true);
      expect(fileExists(outputDir, 'apps/web')).toBe(true);
    });

    it('Dockerfile uses workspace-aware CMD for full-stack projects', () => {
      const dockerfile = readFile(outputDir, 'Dockerfile');
      expect(dockerfile).toContain('RUN pnpm build');
      // Full-stack projects get the workspace-aware entrypoint
      expect(dockerfile).toContain('dist/apps/api/src/main.js');
    });
  });

  describe('docker-compose with full-stack', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-compose-fullstack-'));
      const config = makeConfig({
        outputDir,
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        deploymentTargets: ['docker-compose'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'package.json')).toBe(true);
    });

    it('docker-compose.yml includes a web service for full-stack projects', () => {
      const compose = readFile(outputDir, 'docker-compose.yml');
      expect(compose).toContain('app:');
      expect(compose).toContain('web:');
    });
  });

  describe('dockerfile with monorepo', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-docker-monorepo-'));
      const config = makeConfig({
        outputDir,
        projectType: 'monorepo',
        deploymentTargets: ['dockerfile'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('Dockerfile CMD matches monorepo build output path', () => {
      const dockerfile = readFile(outputDir, 'Dockerfile');
      // Monorepo projects get the workspace-aware entrypoint
      expect(dockerfile).toContain('dist/apps/api/src/main.js');

      // And nest-cli.json entryFile aligns with it
      const nestCli = JSON.parse(readFile(outputDir, 'nest-cli.json'));
      expect(nestCli.entryFile).toBe('apps/api/src/main');
    });
  });
});

// ---------------------------------------------------------------------------
// Section 6: CI/CD + cloud provider alignment
// ---------------------------------------------------------------------------
describe('CI/CD + cloud provider alignment', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('gcp-cloudbuild with cloudProvider aws', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cicd-cross-'));
      const config = makeConfig({
        outputDir,
        cloudProvider: 'aws',
        ciCdProvider: 'gcp-cloudbuild',
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error (no validation prevents cross-cloud)', () => {
      expect(fileExists(outputDir, 'cloudbuild.yaml')).toBe(true);
    });

    // BUG: No validation prevents selecting gcp-cloudbuild as CI/CD provider
    // while cloudProvider is 'aws'. The generated cloudbuild.yaml references
    // GCP Artifact Registry (${_REGION}-docker.pkg.dev/${PROJECT_ID}/...) but
    // the project is configured for AWS. There is no warning or adaptation.
    it('cloudbuild.yaml references GCP Artifact Registry despite AWS cloud provider (documents known issue)', () => {
      const cb = readFile(outputDir, 'cloudbuild.yaml');
      expect(cb).toContain('gcr.io/cloud-builders/docker');
      expect(cb).toContain('.pkg.dev');
    });
  });

  describe('aws-codepipeline with cloudProvider gcp', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cicd-cross2-'));
      const config = makeConfig({
        outputDir,
        cloudProvider: 'gcp',
        ciCdProvider: 'aws-codepipeline',
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error (no validation prevents cross-cloud)', () => {
      expect(fileExists(outputDir, 'buildspec.yml')).toBe(true);
    });

    // BUG: aws-codepipeline buildspec.yml is an AWS CodeBuild spec but the
    // project is configured for GCP. No validation or warning.
    it('buildspec.yml is AWS-specific despite GCP cloud provider (documents known issue)', () => {
      const buildspec = readFile(outputDir, 'buildspec.yml');
      // buildspec.yml is inherently AWS CodeBuild, no GCP adaptation
      expect(buildspec).toContain('version: 0.2');
    });
  });

  describe('azure-devops with cloudProvider aws', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-cicd-azdo-aws-'));
      const config = makeConfig({
        outputDir,
        cloudProvider: 'aws',
        ciCdProvider: 'azure-devops',
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('generates without error', () => {
      expect(fileExists(outputDir, 'azure-pipelines.yml')).toBe(true);
    });

    // Azure DevOps is cloud-agnostic (it can deploy to any cloud), so this is
    // less of a concern than gcp-cloudbuild with aws.
    it('azure-pipelines.yml is generated regardless of cloud provider', () => {
      const pipeline = readFile(outputDir, 'azure-pipelines.yml');
      expect(pipeline).toContain('pnpm build');
    });
  });
});

// ---------------------------------------------------------------------------
// Section 7: Deployment targets + CI/CD combined
// ---------------------------------------------------------------------------
describe('Deployment targets + CI/CD together', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('dockerfile + github-actions generates both Dockerfile and workflow files', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-cicd-combo-'));
    try {
      const config = makeConfig({
        outputDir,
        deploymentTargets: ['dockerfile'],
        ciCdProvider: 'github-actions',
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'Dockerfile')).toBe(true);
      expect(fileExists(outputDir, '.dockerignore')).toBe(true);
      expect(fileExists(outputDir, '.github/workflows/ci.yml')).toBe(true);
      expect(fileExists(outputDir, '.github/workflows/cd.yml')).toBe(true);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('all deploy targets + all CI/CD providers generate without conflict', async () => {
    // Test each CI/CD provider with all deployment targets
    for (const ciCd of CI_CD_PROVIDERS) {
      const outputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `spoonfeed-full-combo-${ciCd}-`),
      );
      try {
        const config = makeConfig({
          outputDir,
          deploymentTargets: [...DEPLOYMENT_TARGETS],
          ciCdProvider: ciCd,
        });
        await generate(config, registry, TEMPLATES_DIR);

        expect(fileExists(outputDir, 'package.json')).toBe(true);
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Section 8: Terraform + cloud provider interactions
// ---------------------------------------------------------------------------
describe('Terraform + cloud provider interactions', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('terraform with cloudProvider gcp generates GCP-specific infrastructure', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-tf-gcp-'));
    try {
      const config = makeConfig({
        outputDir,
        cloudProvider: 'gcp',
        deploymentTargets: ['terraform'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTf = readFile(outputDir, 'main.tf');
      // FIXED: Terraform templates are now cloud-aware. GCP uses GCS backend.
      expect(mainTf).toContain('backend "gcs"');
      expect(mainTf).not.toContain('backend "s3"');

      const appMainTf = readFile(outputDir, 'modules/app/main.tf');
      // GCP generates Cloud Run resources, not AWS ECS
      expect(appMainTf).toContain('google_cloud_run_v2_service');
      expect(appMainTf).not.toContain('aws_ecs_cluster');
      expect(appMainTf).not.toContain('aws_ecs_service');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('terraform with cloudProvider azure generates Azure-specific infrastructure', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-tf-azure-'));
    try {
      const config = makeConfig({
        outputDir,
        cloudProvider: 'azure',
        deploymentTargets: ['terraform'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTf = readFile(outputDir, 'main.tf');
      // FIXED: Azure uses azurerm backend
      expect(mainTf).toContain('backend "azurerm"');
      expect(mainTf).not.toContain('backend "s3"');

      const appMainTf = readFile(outputDir, 'modules/app/main.tf');
      // Azure generates Container Apps resources, not AWS ECS
      expect(appMainTf).toContain('azurerm_container_app');
      expect(appMainTf).not.toContain('aws_ecs_cluster');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Section 9: Edge cases
// ---------------------------------------------------------------------------
describe('Deployment edge cases', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('empty deploymentTargets array produces no deploy files', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-no-deploy-'));
    try {
      const config = makeConfig({
        outputDir,
        deploymentTargets: [],
        ciCdProvider: undefined,
      });
      await generate(config, registry, TEMPLATES_DIR);

      expect(fileExists(outputDir, 'Dockerfile')).toBe(false);
      expect(fileExists(outputDir, 'docker-compose.yml')).toBe(false);
      expect(fileExists(outputDir, 'k8s')).toBe(false);
      expect(fileExists(outputDir, 'serverless.yml')).toBe(false);
      expect(fileExists(outputDir, 'main.tf')).toBe(false);
      expect(fileExists(outputDir, '.github/workflows')).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('project with scoped name renders correctly in serverless.yml', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scoped-sls-'));
    try {
      const config = makeConfig({
        outputDir,
        name: 'my-api',
        scope: '@acme',
        deploymentTargets: ['serverless-framework'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const sls = readFile(outputDir, 'serverless.yml');
      // The serverless.yml uses `<%= name %>` which is the raw project name
      // (not the scoped package name)
      expect(sls).toContain('my-api');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('project with scoped name renders correctly in terraform main.tf', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scoped-tf-'));
    try {
      const config = makeConfig({
        outputDir,
        name: 'my-api',
        scope: '@acme',
        deploymentTargets: ['terraform'],
      });
      await generate(config, registry, TEMPLATES_DIR);

      const mainTf = readFile(outputDir, 'main.tf');
      expect(mainTf).toContain('my-api');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('deployment targets do not interfere with recipe files', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-deploy-recipe-'));
    try {
      const config = makeConfig({
        outputDir,
        recipes: ['jwt-auth', 'swagger'],
        deploymentTargets: ['dockerfile', 'kubernetes'],
        ciCdProvider: 'github-actions',
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Recipe files should still exist
      expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(true);
      expect(fileExists(outputDir, 'src/shared/decorators/current-user.decorator.ts')).toBe(true);

      // Deploy files should exist
      expect(fileExists(outputDir, 'Dockerfile')).toBe(true);
      expect(fileExists(outputDir, 'k8s/deployment.yaml')).toBe(true);

      // CI/CD files should exist
      expect(fileExists(outputDir, '.github/workflows/ci.yml')).toBe(true);

      // package.json should have recipe deps
      const pkg = JSON.parse(readFile(outputDir, 'package.json'));
      expect(pkg.dependencies['@nestjs/jwt']).toBeDefined();
      expect(pkg.dependencies['@nestjs/swagger']).toBeDefined();
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Section 10: GitHub Actions + .github directory interaction with copilot-instructions
// ---------------------------------------------------------------------------
describe('GitHub Actions .github directory interaction', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  it('github-actions ci/cd files coexist with copilot-instructions.md', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-gh-copilot-'));
    try {
      const config = makeConfig({
        outputDir,
        recipes: ['swagger'],
        ciCdProvider: 'github-actions',
      });
      await generate(config, registry, TEMPLATES_DIR);

      // Both should exist under .github/
      expect(fileExists(outputDir, '.github/workflows/ci.yml')).toBe(true);
      expect(fileExists(outputDir, '.github/workflows/cd.yml')).toBe(true);
      expect(fileExists(outputDir, '.github/copilot-instructions.md')).toBe(true);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
