import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generate } from '@spoonfeed/generator/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { ProjectConfig } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

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

function fileExists(outputDir: string, filePath: string): boolean {
  return fs.existsSync(path.join(outputDir, filePath));
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

/**
 * Recursively read all text files in a directory.
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
// Section 1: Generate with scoped name (@myorg/my-project)
// ---------------------------------------------------------------------------
describe('Scoped package names: @myorg/my-project', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scoped-'));
    const config = makeConfig({
      outputDir,
      name: 'my-project',
      scope: '@myorg',
      recipes: ['swagger', 'pino'],
      deploymentTargets: ['dockerfile', 'kubernetes', 'docker-compose'],
      ciCdProvider: 'github-actions',
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('package.json has scoped name "@myorg/my-project"', () => {
    const pkg = readJson(outputDir, 'package.json');
    expect(pkg.name).toBe('@myorg/my-project');
  });

  it('CLAUDE.md is created and contains project type', () => {
    const claudeMd = readFile(outputDir, 'CLAUDE.md');
    expect(claudeMd).toContain('http-api');
  });

  it('CLAUDE.md mentions project name and scope', () => {
    const claudeMd = readFile(outputDir, 'CLAUDE.md');
    expect(claudeMd).toContain('my-project');
    expect(claudeMd).toContain('@myorg');
  });

  it('.spoonfeed.json is created with correct project metadata', () => {
    expect(fileExists(outputDir, '.spoonfeed.json')).toBe(true);
    const manifest = readJson(outputDir, '.spoonfeed.json');
    expect(manifest.projectType).toBe('http-api');
    expect(manifest.httpAdapter).toBe('fastify');
  });

  it('.spoonfeed.json stores name and scope', () => {
    const manifest = readJson(outputDir, '.spoonfeed.json');
    expect(manifest).toHaveProperty('name', 'my-project');
    expect(manifest).toHaveProperty('scope', '@myorg');
  });

  it('Dockerfile is created without scope leaking into image/label context', () => {
    const dockerfile = readFile(outputDir, 'Dockerfile');
    // Dockerfile template does not use the project name or scope at all.
    // The only @ in the file is from "pnpm@10" which is not a scope reference.
    expect(dockerfile).not.toContain('@myorg');
    expect(dockerfile).not.toContain('@myorg/my-project');
  });

  it('k8s deployment.yaml uses project name without scope prefix', () => {
    const deployment = readFile(outputDir, 'k8s/deployment.yaml');
    expect(deployment).toContain('name: my-project');
    expect(deployment).toContain('app: my-project');
    // The @ character must NOT appear in k8s metadata names or label values
    expect(deployment).not.toContain('@myorg');
    expect(deployment).not.toContain('@');
  });

  it('k8s service.yaml uses project name without scope prefix', () => {
    const service = readFile(outputDir, 'k8s/service.yaml');
    expect(service).toContain('name: my-project');
    expect(service).not.toContain('@');
  });

  it('k8s ingress.yaml uses project name without scope prefix', () => {
    const ingress = readFile(outputDir, 'k8s/ingress.yaml');
    expect(ingress).toContain('name: my-project');
    expect(ingress).toContain('my-project.example.com');
    expect(ingress).not.toContain('@');
  });

  it('k8s configmap.yaml uses project name without scope prefix', () => {
    const configmap = readFile(outputDir, 'k8s/configmap.yaml');
    expect(configmap).toContain('name: my-project-config');
    expect(configmap).not.toContain('@');
  });

  it('k8s hpa.yaml uses project name without scope prefix', () => {
    const hpa = readFile(outputDir, 'k8s/hpa.yaml');
    expect(hpa).toContain('name: my-project');
    expect(hpa).not.toContain('@');
  });

  it('docker-compose.yml does not contain scope characters', () => {
    const compose = readFile(outputDir, 'docker-compose.yml');
    expect(compose).not.toContain('@myorg');
    expect(compose).not.toContain('@');
  });

  it('CI workflow files exist and have no EJS residue', () => {
    const ci = readFile(outputDir, '.github/workflows/ci.yml');
    const cd = readFile(outputDir, '.github/workflows/cd.yml');
    expect(ci).toContain('pnpm install');
    expect(cd).toContain('pnpm install');
    // CI/CD templates do not reference the project name directly
    expect(ci).not.toContain('@myorg');
    expect(cd).not.toContain('@myorg');
  });

  it('no generated file contains "undefined" as a literal string artifact', () => {
    const allFiles = readAllFiles(outputDir);
    const violations: string[] = [];
    for (const file of allFiles) {
      // Skip JSON files where "undefined" could be a valid string in descriptions
      if (file.relative.endsWith('.json')) continue;
      // Check for patterns like ": undefined" or "= undefined" or "/undefined/"
      // that indicate a template variable was not properly set
      if (/[:=\/]undefined[\/\s"',;)}]/.test(file.content)) {
        violations.push(file.relative);
      }
    }
    expect(violations).toEqual([]);
  });

  it('no generated file contains "null" as a literal template artifact', () => {
    const allFiles = readAllFiles(outputDir);
    const violations: string[] = [];
    for (const file of allFiles) {
      if (file.relative.endsWith('.json')) continue;
      // Check for "null" appearing where a name should be (e.g., "name: null")
      if (/name:\s*null/.test(file.content) || /service:\s*null/.test(file.content)) {
        violations.push(file.relative);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Section 2: Generate without scope (scope: undefined)
// ---------------------------------------------------------------------------
describe('Unscoped package names: no scope artifacts', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-unscoped-'));
    const config = makeConfig({
      outputDir,
      name: 'my-api',
      scope: undefined,
      deploymentTargets: ['dockerfile', 'kubernetes', 'docker-compose', 'serverless-framework', 'terraform'],
      ciCdProvider: 'github-actions',
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('package.json has unscoped name "my-api"', () => {
    const pkg = readJson(outputDir, 'package.json');
    expect(pkg.name).toBe('my-api');
  });

  it('package.json name does not contain "undefined" prefix', () => {
    const pkg = readJson(outputDir, 'package.json');
    const name = pkg.name as string;
    expect(name).not.toContain('undefined');
    expect(name).not.toContain('null');
    expect(name).not.toMatch(/^\//); // No leading slash from "undefined/"
  });

  it('k8s deployment.yaml uses "my-api" directly', () => {
    const deployment = readFile(outputDir, 'k8s/deployment.yaml');
    expect(deployment).toContain('name: my-api');
    expect(deployment).not.toContain('undefined');
    expect(deployment).not.toContain('null');
  });

  it('serverless.yml uses "my-api" as service name', () => {
    const sls = readFile(outputDir, 'serverless.yml');
    expect(sls).toContain('service: my-api');
    expect(sls).not.toContain('undefined');
  });

  it('terraform main.tf uses "my-api" as app_name', () => {
    const mainTf = readFile(outputDir, 'main.tf');
    expect(mainTf).toContain('"my-api"');
    expect(mainTf).not.toContain('undefined');
  });

  it('.spoonfeed.json is valid JSON without undefined artifacts', () => {
    const raw = readFile(outputDir, '.spoonfeed.json');
    expect(raw).not.toContain('undefined');
    const manifest = JSON.parse(raw);
    expect(manifest).toBeDefined();
  });

  it('no file in the entire output contains "undefined" as a template artifact', () => {
    const allFiles = readAllFiles(outputDir);
    const violations: string[] = [];
    for (const file of allFiles) {
      if (file.relative.endsWith('.json')) continue;
      if (/[:=\/]undefined[\/\s"',;)}]/.test(file.content)) {
        violations.push(`${file.relative}: contains "undefined" artifact`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Section 3: Edge case names
// ---------------------------------------------------------------------------
describe('Edge case project names', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('very long project name (63 chars - k8s limit)', () => {
    let outputDir: string;
    // k8s metadata.name must be <= 63 chars (RFC 1123 DNS label)
    const longName = 'a-very-long-project-name-that-exceeds-the-typical-expectations1';

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-longname-'));
      const config = makeConfig({
        outputDir,
        name: longName,
        deploymentTargets: ['kubernetes', 'serverless-framework', 'terraform'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('package.json contains the long name', () => {
      const pkg = readJson(outputDir, 'package.json');
      expect(pkg.name).toBe(longName);
    });

    it('k8s deployment.yaml uses the long name (within 63 char limit)', () => {
      const deployment = readFile(outputDir, 'k8s/deployment.yaml');
      expect(deployment).toContain(`name: ${longName}`);
      // Verify this specific name is exactly at the limit
      expect(longName.length).toBe(63);
    });

    // BUG: k8s configmap name = "<name>-config" can exceed the 63-character limit
    // for RFC 1123 DNS labels. A 63-char project name produces "a-very-long...-config"
    // which is 63 + 7 = 70 characters. Kubernetes will reject this at apply time.
    // The generator does not validate or truncate k8s resource names.
    it('k8s configmap name exceeds 63 char k8s limit (documents bug)', () => {
      const configmap = readFile(outputDir, 'k8s/configmap.yaml');
      const configmapName = `${longName}-config`;
      expect(configmap).toContain(`name: ${configmapName}`);
      expect(configmapName.length).toBeGreaterThan(63);
    });

    // BUG: k8s secret reference "<name>-secrets" also exceeds 63-char limit.
    // deployment.yaml references a secretRef with name "<name>-secrets"
    // which is 63 + 8 = 71 characters.
    it('k8s deployment secretRef name exceeds 63 char limit (documents bug)', () => {
      const deployment = readFile(outputDir, 'k8s/deployment.yaml');
      const secretsName = `${longName}-secrets`;
      expect(deployment).toContain(`name: ${secretsName}`);
      expect(secretsName.length).toBeGreaterThan(63);
    });

    // BUG: k8s ingress TLS secret name "<name>-tls" also exceeds 63-char limit.
    it('k8s ingress TLS secret name exceeds 63 char limit (documents bug)', () => {
      const ingress = readFile(outputDir, 'k8s/ingress.yaml');
      const tlsName = `${longName}-tls`;
      expect(ingress).toContain(`secretName: ${tlsName}`);
      expect(tlsName.length).toBeGreaterThan(63);
    });

    it('serverless.yml uses the long name as service name', () => {
      const sls = readFile(outputDir, 'serverless.yml');
      expect(sls).toContain(`service: ${longName}`);
    });

    it('terraform main.tf uses the long name', () => {
      const mainTf = readFile(outputDir, 'main.tf');
      expect(mainTf).toContain(`"${longName}"`);
    });
  });

  describe('name exceeding 63 chars (k8s violation)', () => {
    let outputDir: string;
    // This name is 70 characters, exceeding the k8s 63-char limit for metadata.name
    const overLongName = 'this-is-an-extremely-long-project-name-that-definitely-exceeds-k8s-max';

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-overlongname-'));
      const config = makeConfig({
        outputDir,
        name: overLongName,
        deploymentTargets: ['kubernetes'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    // BUG: k8s metadata.name has a 63-character limit (RFC 1123 DNS label).
    // The generator does not validate or truncate the name for k8s compatibility.
    // A 70-character project name produces deployment.yaml with metadata.name
    // exceeding 63 characters, which kubectl will reject at apply time.
    it('k8s deployment.yaml metadata.name exceeds 63 chars (documents bug)', () => {
      const deployment = readFile(outputDir, 'k8s/deployment.yaml');
      expect(overLongName.length).toBe(70);
      expect(deployment).toContain(`name: ${overLongName}`);
    });

    // BUG: k8s label values also have a 63-character max length.
    // The "app: <name>" label in deployment.yaml exceeds this limit.
    it('k8s deployment.yaml label value exceeds 63 chars (documents bug)', () => {
      const deployment = readFile(outputDir, 'k8s/deployment.yaml');
      expect(deployment).toContain(`app: ${overLongName}`);
      expect(overLongName.length).toBeGreaterThan(63);
    });
  });

  describe('name with multiple hyphens: my-super-long-api-service', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-multihyphen-'));
      const config = makeConfig({
        outputDir,
        name: 'my-super-long-api-service',
        scope: '@myorg',
        deploymentTargets: ['kubernetes', 'serverless-framework'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('package.json has correct scoped name', () => {
      const pkg = readJson(outputDir, 'package.json');
      expect(pkg.name).toBe('@myorg/my-super-long-api-service');
    });

    it('k8s deployment uses name without scope', () => {
      const deployment = readFile(outputDir, 'k8s/deployment.yaml');
      expect(deployment).toContain('name: my-super-long-api-service');
      expect(deployment).not.toContain('@myorg');
    });

    it('serverless.yml uses name without scope', () => {
      const sls = readFile(outputDir, 'serverless.yml');
      expect(sls).toContain('service: my-super-long-api-service');
      expect(sls).not.toContain('@myorg');
    });

    it('k8s ingress hostname uses hyphened name correctly', () => {
      const ingress = readFile(outputDir, 'k8s/ingress.yaml');
      expect(ingress).toContain('my-super-long-api-service.example.com');
    });
  });

  describe('scope with hyphens: @my-org', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-hyphenscope-'));
      const config = makeConfig({
        outputDir,
        name: 'api',
        scope: '@my-org',
        deploymentTargets: ['kubernetes', 'dockerfile'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('package.json has correct scoped name with hyphenated scope', () => {
      const pkg = readJson(outputDir, 'package.json');
      expect(pkg.name).toBe('@my-org/api');
    });

    it('k8s manifests use only the name part, not the scope', () => {
      const deployment = readFile(outputDir, 'k8s/deployment.yaml');
      expect(deployment).toContain('name: api');
      expect(deployment).toContain('app: api');
      expect(deployment).not.toContain('@my-org');
      expect(deployment).not.toContain('my-org');
    });

    it('Dockerfile does not contain scope', () => {
      const dockerfile = readFile(outputDir, 'Dockerfile');
      expect(dockerfile).not.toContain('@my-org');
    });
  });

  describe('single character name: "a"', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-singlechar-'));
      const config = makeConfig({
        outputDir,
        name: 'a',
        scope: '@x',
        deploymentTargets: ['kubernetes', 'serverless-framework', 'terraform'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('package.json has scoped single-char name', () => {
      const pkg = readJson(outputDir, 'package.json');
      expect(pkg.name).toBe('@x/a');
    });

    it('k8s deployment uses single-char name', () => {
      const deployment = readFile(outputDir, 'k8s/deployment.yaml');
      expect(deployment).toContain('name: a');
      expect(deployment).toContain('app: a');
    });

    it('k8s configmap uses single-char name with suffix', () => {
      const configmap = readFile(outputDir, 'k8s/configmap.yaml');
      expect(configmap).toContain('name: a-config');
    });

    it('serverless.yml uses single-char name', () => {
      const sls = readFile(outputDir, 'serverless.yml');
      expect(sls).toContain('service: a');
    });

    it('terraform main.tf uses single-char name', () => {
      const mainTf = readFile(outputDir, 'main.tf');
      expect(mainTf).toContain('"a"');
    });
  });
});

// ---------------------------------------------------------------------------
// Section 4: K8s templates with scoped names - @ character validation
// ---------------------------------------------------------------------------
describe('K8s templates: scoped names must not leak @ into manifests', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-k8s-scope-'));
    const config = makeConfig({
      outputDir,
      name: 'my-service',
      scope: '@acme-corp',
      deploymentTargets: ['kubernetes'],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('no k8s manifest file contains @ character', () => {
    const k8sFiles = ['deployment.yaml', 'service.yaml', 'configmap.yaml', 'ingress.yaml', 'hpa.yaml'];
    const violations: string[] = [];
    for (const file of k8sFiles) {
      const filePath = `k8s/${file}`;
      if (fileExists(outputDir, filePath)) {
        const content = readFile(outputDir, filePath);
        if (content.includes('@')) {
          violations.push(`${filePath}: contains @ character`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('k8s metadata.name values are valid DNS labels (RFC 1123)', () => {
    const k8sFiles = ['deployment.yaml', 'service.yaml', 'configmap.yaml', 'ingress.yaml', 'hpa.yaml'];
    // RFC 1123: lowercase alphanumeric, hyphens, max 63 chars, must start/end with alphanumeric
    const dns1123Regex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

    for (const file of k8sFiles) {
      const filePath = `k8s/${file}`;
      if (fileExists(outputDir, filePath)) {
        const content = readFile(outputDir, filePath);
        const nameMatches = content.match(/^\s*name:\s*(.+)$/gm);
        if (nameMatches) {
          for (const match of nameMatches) {
            const nameValue = match.replace(/^\s*name:\s*/, '').trim();
            // Skip YAML references and quoted strings
            if (nameValue.startsWith('*') || nameValue.startsWith('"')) continue;
            expect({
              file: filePath,
              name: nameValue,
              valid: dns1123Regex.test(nameValue),
            }).toEqual({
              file: filePath,
              name: nameValue,
              valid: true,
            });
          }
        }
      }
    }
  });

  it('k8s label values do not contain @ character', () => {
    const deployment = readFile(outputDir, 'k8s/deployment.yaml');
    const labelMatches = deployment.match(/app:\s*(.+)$/gm);
    expect(labelMatches).toBeDefined();
    for (const match of labelMatches!) {
      const value = match.replace(/app:\s*/, '').trim();
      expect(value).not.toContain('@');
    }
  });
});

// ---------------------------------------------------------------------------
// Section 5: Docker image names - @ is invalid in Docker image names
// ---------------------------------------------------------------------------
describe('Docker templates: scoped names must not break Docker', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('Dockerfile with scoped name', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-docker-scope-'));
      const config = makeConfig({
        outputDir,
        name: 'my-service',
        scope: '@acme-corp',
        deploymentTargets: ['dockerfile'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('Dockerfile does not contain scope reference', () => {
      const dockerfile = readFile(outputDir, 'Dockerfile');
      // The only @ in Dockerfile is from "pnpm@10", not from scope leakage
      expect(dockerfile).not.toContain('@acme-corp');
      expect(dockerfile).not.toContain('@acme-corp/my-service');
    });

    it('Dockerfile does not reference the scope in any image name or label', () => {
      const dockerfile = readFile(outputDir, 'Dockerfile');
      expect(dockerfile).not.toContain('acme-corp');
      expect(dockerfile).not.toContain('@acme-corp');
    });

    it('.dockerignore does not contain @ character', () => {
      const dockerignore = readFile(outputDir, '.dockerignore');
      expect(dockerignore).not.toContain('@');
    });
  });

  describe('docker-compose with scoped name', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-compose-scope-'));
      const config = makeConfig({
        outputDir,
        name: 'my-service',
        scope: '@acme-corp',
        deploymentTargets: ['docker-compose'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('docker-compose.yml does not contain @ in service or image names', () => {
      const compose = readFile(outputDir, 'docker-compose.yml');
      // docker-compose template uses hardcoded service name "app", not the project name
      expect(compose).not.toContain('@acme-corp');
    });
  });

  describe('Dockerfile with workspace project types (full-stack)', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-docker-fullstack-scope-'));
      const config = makeConfig({
        outputDir,
        name: 'my-app',
        scope: '@enterprise',
        projectType: 'full-stack',
        frontendFramework: 'nextjs',
        deploymentTargets: ['dockerfile'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('package.json has full scoped name', () => {
      const pkg = readJson(outputDir, 'package.json');
      expect(pkg.name).toBe('@enterprise/my-app');
    });

    it('Dockerfile uses workspace-aware CMD without scope', () => {
      const dockerfile = readFile(outputDir, 'Dockerfile');
      expect(dockerfile).toContain('dist/apps/api/src/main.js');
      expect(dockerfile).not.toContain('@enterprise');
    });
  });
});

// ---------------------------------------------------------------------------
// Section 6: Serverless & Terraform with scoped names
// ---------------------------------------------------------------------------
describe('Serverless & Terraform: scoped names', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-sls-tf-scope-'));
    const config = makeConfig({
      outputDir,
      name: 'payment-api',
      scope: '@fintech',
      deploymentTargets: ['serverless-framework', 'terraform'],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('serverless.yml uses project name without scope', () => {
    const sls = readFile(outputDir, 'serverless.yml');
    // Serverless service names cannot contain @
    expect(sls).toContain('service: payment-api');
    expect(sls).not.toContain('@fintech');
    expect(sls).not.toContain('@');
  });

  it('terraform main.tf uses project name without scope', () => {
    const mainTf = readFile(outputDir, 'main.tf');
    expect(mainTf).toContain('"payment-api"');
    expect(mainTf).not.toContain('@fintech');
    expect(mainTf).not.toContain('@');
  });
});

// ---------------------------------------------------------------------------
// Section 7: Scoped names with workspace project types
// ---------------------------------------------------------------------------
describe('Scoped names with monorepo/full-stack project types', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  describe('monorepo with scope', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-monorepo-scope-'));
      const config = makeConfig({
        outputDir,
        name: 'platform',
        scope: '@acme',
        projectType: 'monorepo',
        deploymentTargets: ['kubernetes'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('package.json has scoped name', () => {
      const pkg = readJson(outputDir, 'package.json');
      expect(pkg.name).toBe('@acme/platform');
    });

    it('apps/api/src/main.ts exists', () => {
      expect(fileExists(outputDir, 'apps/api/src/main.ts')).toBe(true);
    });

    it('k8s manifests use "platform" not "@acme/platform"', () => {
      const deployment = readFile(outputDir, 'k8s/deployment.yaml');
      expect(deployment).toContain('name: platform');
      expect(deployment).not.toContain('@acme');
    });
  });

  describe('full-stack with scope', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-fullstack-scope-'));
      const config = makeConfig({
        outputDir,
        name: 'dashboard',
        scope: '@corp',
        projectType: 'full-stack',
        frontendFramework: 'vite-react',
        deploymentTargets: ['docker-compose'],
      });
      await generate(config, registry, TEMPLATES_DIR);
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('package.json has scoped name', () => {
      const pkg = readJson(outputDir, 'package.json');
      expect(pkg.name).toBe('@corp/dashboard');
    });

    it('apps/api and apps/web directories exist', () => {
      expect(fileExists(outputDir, 'apps/api/src/main.ts')).toBe(true);
      expect(fileExists(outputDir, 'apps/web')).toBe(true);
    });

    it('docker-compose.yml includes web service for full-stack', () => {
      const compose = readFile(outputDir, 'docker-compose.yml');
      expect(compose).toContain('web:');
      expect(compose).not.toContain('@corp');
    });
  });
});

// ---------------------------------------------------------------------------
// Section 8: Comprehensive scoped name + recipe interaction
// ---------------------------------------------------------------------------
describe('Scoped names with recipes: template data correctness', () => {
  let outputDir: string;
  let registry: RecipeRegistry;

  beforeAll(async () => {
    registry = createRegistry();
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spoonfeed-scope-recipes-'));
    const config = makeConfig({
      outputDir,
      name: 'billing-api',
      scope: '@payments',
      recipes: ['jwt-auth', 'swagger', 'typeorm-postgres'],
      deploymentTargets: ['kubernetes'],
    });
    await generate(config, registry, TEMPLATES_DIR);
  });

  afterAll(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('package.json has correct scoped name with recipe deps', () => {
    const pkg = readJson(outputDir, 'package.json');
    expect(pkg.name).toBe('@payments/billing-api');
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@nestjs/jwt']).toBeDefined();
    expect(deps['@nestjs/swagger']).toBeDefined();
    expect(deps['typeorm']).toBeDefined();
  });

  it('recipe template files are placed correctly', () => {
    expect(fileExists(outputDir, 'src/shared/guards/jwt-auth.guard.ts')).toBe(true);
    expect(fileExists(outputDir, 'src/shared/decorators/current-user.decorator.ts')).toBe(true);
  });

  it('CLAUDE.md includes recipe sections', () => {
    const claudeMd = readFile(outputDir, 'CLAUDE.md');
    expect(claudeMd).toContain('Swagger');
    expect(claudeMd).toContain('TypeORM');
    expect(claudeMd).toContain('JWT');
  });

  it('.spoonfeed.json records all three recipes', () => {
    const manifest = readJson(outputDir, '.spoonfeed.json');
    const recipes = manifest.recipes as Record<string, unknown>;
    expect(Object.keys(recipes)).toContain('jwt-auth');
    expect(Object.keys(recipes)).toContain('swagger');
    expect(Object.keys(recipes)).toContain('typeorm-postgres');
  });

  it('k8s deployment uses project name from scoped package', () => {
    const deployment = readFile(outputDir, 'k8s/deployment.yaml');
    expect(deployment).toContain('name: billing-api');
    expect(deployment).not.toContain('@payments');
  });

  it('.env.example has base vars and recipe env vars', () => {
    const env = readFile(outputDir, '.env.example');
    expect(env).toContain('PORT');
    expect(env).toContain('NODE_ENV');
    expect(env).toContain('DB_HOST');
  });
});

// ---------------------------------------------------------------------------
// Section 9: All CI/CD providers with scoped names
// ---------------------------------------------------------------------------
describe('All CI/CD providers with scoped names', () => {
  let registry: RecipeRegistry;

  beforeAll(() => {
    registry = createRegistry();
  });

  const ciCdProviders = [
    { provider: 'github-actions' as const, files: ['.github/workflows/ci.yml', '.github/workflows/cd.yml'] },
    { provider: 'azure-devops' as const, files: ['azure-pipelines.yml'] },
    { provider: 'aws-codepipeline' as const, files: ['buildspec.yml'] },
    { provider: 'gcp-cloudbuild' as const, files: ['cloudbuild.yaml'] },
  ];

  it.each(ciCdProviders)('$provider: generates without scope leaking into CI config', async ({ provider, files }) => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `spoonfeed-cicd-scope-${provider}-`));
    try {
      const config = makeConfig({
        outputDir,
        name: 'scoped-service',
        scope: '@myorg',
        ciCdProvider: provider,
      });
      await generate(config, registry, TEMPLATES_DIR);

      for (const file of files) {
        expect(fileExists(outputDir, file)).toBe(true);
        const content = readFile(outputDir, file);
        // CI/CD configs should not reference the npm scope
        // (they use pnpm commands, not package names)
        expect(content).not.toContain('@myorg/scoped-service');
      }
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
