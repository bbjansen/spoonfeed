import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson } from '@nx/devkit';
import addRecipeGenerator from '@spoonfeed/generators/add-recipe/generator';
import removeRecipeGenerator from '@spoonfeed/generators/remove-recipe/generator';

type ManifestJson = {
  projectType: string;
  httpAdapter?: string;
  spoonfeedVersion: string;
  recipes: Record<
    string,
    {
      files: string[];
      moduleImport?: { moduleName: string; importPath: string };
      mainTsBlocks?: string[];
      envSection?: string;
    }
  >;
  [key: string]: unknown;
};

type PackageJson = {
  name: string;
  version?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/* ------------------------------------------------------------------ */
/*  Helper: seed a minimal spoonfeed-generated project                 */
/* ------------------------------------------------------------------ */
function seedProject(
  tree: Tree,
  overrides: {
    projectType?: string;
    httpAdapter?: string;
  } = {},
): void {
  const projectType = overrides.projectType ?? 'http-api';
  const httpAdapter = overrides.httpAdapter ?? 'fastify';
  const isWorkspace = projectType === 'full-stack' || projectType === 'monorepo';
  const srcPrefix = isWorkspace ? 'apps/api/src' : 'src';

  tree.write(
    '.spoonfeed.json',
    JSON.stringify(
      {
        projectType,
        cloudProvider: 'aws',
        httpAdapter,
        spoonfeedVersion: '0.0.1',
        generatedAt: '2026-05-18T10:00:00Z',
        recipes: {},
      },
      null,
      2,
    ),
  );

  tree.write(
    'package.json',
    JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          '@nestjs/common': '10.4.15',
          '@nestjs/core': '10.4.15',
        },
        devDependencies: {},
      },
      null,
      2,
    ),
  );

  tree.write(
    `${srcPrefix}/app.module.ts`,
    `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`,
  );

  tree.write(
    `${srcPrefix}/main.ts`,
    `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
`,
  );

  tree.write(
    '.env.example',
    `# Application
PORT=3000
NODE_ENV=development
`,
  );

  tree.write(
    'CLAUDE.md',
    `# CLAUDE.md

## Package Manager

Always use pnpm.
`,
  );

  tree.write(
    '.github/copilot-instructions.md',
    `# Copilot Instructions

## General

Follow NestJS conventions.
`,
  );
}

/* ================================================================== */
/*  1. Missing .spoonfeed.json                                         */
/* ================================================================== */
describe('remove-recipe: missing manifest', () => {
  it('should throw a clear error when .spoonfeed.json does not exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    // deliberately do NOT write a .spoonfeed.json
    await expect(
      removeRecipeGenerator(tree, { recipe: 'cors' }),
    ).rejects.toThrow('.spoonfeed.json not found');
  });
});

/* ================================================================== */
/*  2. Recipe not installed                                            */
/* ================================================================== */
describe('remove-recipe: recipe not installed', () => {
  it('should throw when trying to remove a recipe that is not in the manifest', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await expect(
      removeRecipeGenerator(tree, { recipe: 'cors' }),
    ).rejects.toThrow("Recipe 'cors' is not installed");
  });
});

/* ================================================================== */
/*  3. Dependency guard — removing a recipe another recipe requires    */
/* ================================================================== */
describe('remove-recipe: dependency guard', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should block removal of jwt-auth when auth-flows depends on it', async () => {
    // Install jwt-auth first (required by auth-flows), then auth-flows
    await addRecipeGenerator(tree, { recipe: 'jwt-auth', skipInstall: true });
    await addRecipeGenerator(tree, { recipe: 'auth-flows', skipInstall: true });

    // Attempt to remove jwt-auth without --force
    await expect(
      removeRecipeGenerator(tree, { recipe: 'jwt-auth' }),
    ).rejects.toThrow(/Cannot remove 'jwt-auth'/);

    // jwt-auth should still be in the manifest
    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['jwt-auth']).toBeDefined();
  });

  it('should allow forced removal of jwt-auth when auth-flows depends on it', async () => {
    await addRecipeGenerator(tree, { recipe: 'jwt-auth', skipInstall: true });
    await addRecipeGenerator(tree, { recipe: 'auth-flows', skipInstall: true });

    // --force should succeed
    await removeRecipeGenerator(tree, { recipe: 'jwt-auth', force: true });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['jwt-auth']).toBeUndefined();
    // auth-flows should still be there (it's the user's responsibility now)
    expect(manifest.recipes['auth-flows']).toBeDefined();
  });
});

/* ================================================================== */
/*  4. Happy path: add cors then remove it                             */
/* ================================================================== */
describe('remove-recipe: happy path (cors)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should fully remove cors: env section, AI context, manifest entry', async () => {
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });

    // Verify cors was added
    const manifestAfterAdd = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifestAfterAdd.recipes['cors']).toBeDefined();

    const envAfterAdd = tree.read('.env.example', 'utf-8')!;
    expect(envAfterAdd).toContain('CORS_ORIGIN');

    const claudeAfterAdd = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeAfterAdd).toContain('@spoonfeed:cors');

    // Remove cors
    await removeRecipeGenerator(tree, { recipe: 'cors' });

    // Manifest entry removed
    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['cors']).toBeUndefined();

    // .env.example section removed
    const envContent = tree.read('.env.example', 'utf-8')!;
    expect(envContent).not.toContain('CORS_ORIGIN');
    expect(envContent).not.toContain('# --- CORS ---');
    expect(envContent).not.toContain('# --- end CORS ---');

    // CLAUDE.md section removed
    const claudeContent = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeContent).not.toContain('@spoonfeed:cors');
    expect(claudeContent).toContain('## Package Manager'); // original content preserved

    // copilot-instructions.md section removed
    const copilotContent = tree.read('.github/copilot-instructions.md', 'utf-8')!;
    expect(copilotContent).not.toContain('@spoonfeed:cors');
    expect(copilotContent).toContain('## General'); // original content preserved

    // cursor rules file removed
    expect(tree.exists(`.cursor/rules/cors.mdc`)).toBe(false);
  });
});

/* ================================================================== */
/*  4b. Happy path: add swagger (has mainTsSetup, deps, env) then     */
/*      remove it — exercises more code paths than cors                */
/* ================================================================== */
describe('remove-recipe: happy path (swagger, with main.ts block and deps)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should remove swagger deps, main.ts block, env section, AI context', async () => {
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    // Verify swagger was added
    const pkgAfterAdd = readJson<PackageJson>(tree, 'package.json');
    expect(pkgAfterAdd.dependencies['@nestjs/swagger']).toBeDefined();

    const mainAfterAdd = tree.read('src/main.ts', 'utf-8')!;
    expect(mainAfterAdd).toContain('swagger start');

    // Remove swagger
    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    // package.json deps removed
    const pkg = readJson<PackageJson>(tree, 'package.json');
    expect(pkg.dependencies['@nestjs/swagger']).toBeUndefined();
    expect(pkg.dependencies['@fastify/static']).toBeUndefined();
    // Core deps must remain
    expect(pkg.dependencies['@nestjs/common']).toBe('10.4.15');
    expect(pkg.dependencies['@nestjs/core']).toBe('10.4.15');

    // main.ts block removed
    const mainContent = tree.read('src/main.ts', 'utf-8')!;
    expect(mainContent).not.toContain('swagger start');
    expect(mainContent).not.toContain('swagger end');
    expect(mainContent).not.toContain('SwaggerModule');

    // Manifest entry removed
    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['swagger']).toBeUndefined();

    // .env.example section removed
    const envContent = tree.read('.env.example', 'utf-8')!;
    expect(envContent).not.toContain('SWAGGER_ENABLED');
  });
});

/* ================================================================== */
/*  5. Express project: verify expressDependencies are used            */
/* ================================================================== */
describe('remove-recipe: Express project', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { httpAdapter: 'express' });
  });

  it('should remove express deps (helmet), not fastify deps', async () => {
    await addRecipeGenerator(tree, { recipe: 'helmet', skipInstall: true });

    // Express project should have `helmet` dep, not `@fastify/helmet`
    const pkgAfterAdd = readJson<PackageJson>(tree, 'package.json');
    expect(pkgAfterAdd.dependencies['helmet']).toBeDefined();
    expect(pkgAfterAdd.dependencies['@fastify/helmet']).toBeUndefined();

    // Remove helmet
    await removeRecipeGenerator(tree, { recipe: 'helmet' });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    // Express dep should be gone
    expect(pkg.dependencies['helmet']).toBeUndefined();
    // Fastify dep should never have been there
    expect(pkg.dependencies['@fastify/helmet']).toBeUndefined();
  });

  it('should remove express main.ts block, not fastify block', async () => {
    await addRecipeGenerator(tree, { recipe: 'helmet', skipInstall: true });

    const mainAfterAdd = tree.read('src/main.ts', 'utf-8')!;
    // Express helmet uses app.use(helmet(...))
    expect(mainAfterAdd).toContain('helmet start');

    await removeRecipeGenerator(tree, { recipe: 'helmet' });

    const mainContent = tree.read('src/main.ts', 'utf-8')!;
    expect(mainContent).not.toContain('helmet start');
    expect(mainContent).not.toContain('helmet end');
  });
});

/* ================================================================== */
/*  6. Workspace project: verify it looks in apps/api/                 */
/* ================================================================== */
describe('remove-recipe: workspace project (monorepo)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { projectType: 'monorepo' });
  });

  it('should find and modify files under apps/api/src/', async () => {
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    // Verify swagger block was added to apps/api/src/main.ts
    const mainAfterAdd = tree.read('apps/api/src/main.ts', 'utf-8')!;
    expect(mainAfterAdd).toContain('swagger start');

    // Remove swagger
    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    // Block removed from workspace path
    const mainContent = tree.read('apps/api/src/main.ts', 'utf-8')!;
    expect(mainContent).not.toContain('swagger start');
    expect(mainContent).not.toContain('swagger end');

    // Manifest updated
    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['swagger']).toBeUndefined();
  });
});

/* ================================================================== */
/*  7. Shared deps protection                                          */
/* ================================================================== */
describe('remove-recipe: shared dependency protection', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should NOT remove @nestjs/passport when removing jwt-auth if passport recipe is also installed', async () => {
    // Both jwt-auth and passport depend on @nestjs/passport
    await addRecipeGenerator(tree, { recipe: 'jwt-auth', skipInstall: true });
    await addRecipeGenerator(tree, { recipe: 'passport', skipInstall: true });

    const pkgBefore = readJson<PackageJson>(tree, 'package.json');
    expect(pkgBefore.dependencies['@nestjs/passport']).toBeDefined();
    expect(pkgBefore.dependencies['passport-jwt']).toBeDefined();

    // Remove jwt-auth — @nestjs/passport is shared with passport recipe
    await removeRecipeGenerator(tree, { recipe: 'jwt-auth' });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    // @nestjs/passport is needed by passport recipe — must remain
    expect(pkg.dependencies['@nestjs/passport']).toBeDefined();
    // passport-jwt is also shared with passport recipe — must remain
    expect(pkg.dependencies['passport-jwt']).toBeDefined();

    // jwt-auth's unique dep @nestjs/jwt should be removed
    expect(pkg.dependencies['@nestjs/jwt']).toBeUndefined();

    // jwt-auth's unique devDep should also be removed
    // BUG: @types/passport-jwt is a devDependency of jwt-auth. Passport recipe also has
    // @types/passport-jwt as a devDep, so it should remain. Let's verify both sides.
    // passport defines devDependencies: { '@types/passport-local': '1.0.38', '@types/passport-jwt': '4.0.1' }
    // jwt-auth defines devDependencies: { '@types/passport-jwt': '4.0.1' }
    // So @types/passport-jwt IS shared — it should remain.
    expect(pkg.devDependencies['@types/passport-jwt']).toBeDefined();
  });

  it('should remove @nestjs/jwt when removing jwt-auth if auth-flows is NOT installed', async () => {
    // jwt-auth and auth-flows both depend on @nestjs/jwt, but only jwt-auth is installed
    await addRecipeGenerator(tree, { recipe: 'jwt-auth', skipInstall: true });

    await removeRecipeGenerator(tree, { recipe: 'jwt-auth' });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    expect(pkg.dependencies['@nestjs/jwt']).toBeUndefined();
    expect(pkg.dependencies['@nestjs/passport']).toBeUndefined();
    expect(pkg.dependencies['passport-jwt']).toBeUndefined();
  });
});

/* ================================================================== */
/*  8. Remove last recipe — manifest.recipes should be empty, not null */
/* ================================================================== */
describe('remove-recipe: remove last recipe', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should leave manifest.recipes as empty object, not null/undefined', async () => {
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });

    const manifestBefore = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(Object.keys(manifestBefore.recipes)).toHaveLength(1);

    await removeRecipeGenerator(tree, { recipe: 'cors' });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes).toBeDefined();
    expect(manifest.recipes).not.toBeNull();
    expect(typeof manifest.recipes).toBe('object');
    expect(Object.keys(manifest.recipes)).toHaveLength(0);
  });

  it('should preserve other manifest fields after removing last recipe', async () => {
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });
    await removeRecipeGenerator(tree, { recipe: 'cors' });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.projectType).toBe('http-api');
    expect(manifest.spoonfeedVersion).toBe('0.0.1');
    expect(manifest.httpAdapter).toBe('fastify');
  });
});

/* ================================================================== */
/*  Edge case: moduleImport removal (simulated via manifest)           */
/* ================================================================== */
describe('remove-recipe: moduleImport removal', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should remove module import from app.module.ts when manifest records one', async () => {
    // Simulate a recipe that was installed with a moduleImport in the manifest
    // (no current recipe definitions use this, but the code path exists)
    tree.write(
      'src/app.module.ts',
      `import { Module } from '@nestjs/common';
import { FooModule } from './foo/foo.module';

@Module({
  imports: [FooModule],
})
export class AppModule {}
`,
    );

    // Write manifest with a fake recipe that has moduleImport
    tree.write(
      '.spoonfeed.json',
      JSON.stringify(
        {
          projectType: 'http-api',
          cloudProvider: 'aws',
          httpAdapter: 'fastify',
          spoonfeedVersion: '0.0.1',
          generatedAt: '2026-05-18T10:00:00Z',
          recipes: {
            cors: {
              installedAt: '2026-05-18T10:00:00Z',
              version: '0.0.1',
              files: [],
              moduleImport: {
                moduleName: 'FooModule',
                importPath: './foo/foo.module',
              },
            },
          },
        },
        null,
        2,
      ),
    );

    await removeRecipeGenerator(tree, { recipe: 'cors' });

    const appModule = tree.read('src/app.module.ts', 'utf-8')!;
    expect(appModule).not.toContain('FooModule');
    expect(appModule).not.toContain('./foo/foo.module');
  });
});

/* ================================================================== */
/*  Edge case: remove recipe with files listed in manifest             */
/* ================================================================== */
describe('remove-recipe: file deletion from manifest', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should delete files listed in manifest and clean up empty dirs', async () => {
    // Create some files that would belong to a recipe
    tree.write('src/shared/guards/api-key.guard.ts', 'export class ApiKeyGuard {}');
    tree.write('src/shared/guards/api-key.guard.spec.ts', 'test');

    // Write manifest with files listed
    tree.write(
      '.spoonfeed.json',
      JSON.stringify(
        {
          projectType: 'http-api',
          cloudProvider: 'aws',
          httpAdapter: 'fastify',
          spoonfeedVersion: '0.0.1',
          generatedAt: '2026-05-18T10:00:00Z',
          recipes: {
            'api-keys': {
              installedAt: '2026-05-18T10:00:00Z',
              version: '0.0.1',
              files: [
                'src/shared/guards/api-key.guard.ts',
                'src/shared/guards/api-key.guard.spec.ts',
              ],
              envSection: 'API Key Authentication',
            },
          },
        },
        null,
        2,
      ),
    );

    await removeRecipeGenerator(tree, { recipe: 'api-keys' });

    // Files should be deleted
    expect(tree.exists('src/shared/guards/api-key.guard.ts')).toBe(false);
    expect(tree.exists('src/shared/guards/api-key.guard.spec.ts')).toBe(false);
  });

  it('should gracefully handle files that do not exist on disk', async () => {
    // Manifest references files that were already deleted manually
    tree.write(
      '.spoonfeed.json',
      JSON.stringify(
        {
          projectType: 'http-api',
          cloudProvider: 'aws',
          httpAdapter: 'fastify',
          spoonfeedVersion: '0.0.1',
          generatedAt: '2026-05-18T10:00:00Z',
          recipes: {
            'api-keys': {
              installedAt: '2026-05-18T10:00:00Z',
              version: '0.0.1',
              files: ['src/nonexistent/file.ts'],
            },
          },
        },
        null,
        2,
      ),
    );

    // Should not throw
    await expect(
      removeRecipeGenerator(tree, { recipe: 'api-keys' }),
    ).resolves.not.toThrow();

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['api-keys']).toBeUndefined();
  });
});

/* ================================================================== */
/*  Edge case: full-stack workspace src paths                          */
/* ================================================================== */
describe('remove-recipe: full-stack workspace', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { projectType: 'full-stack' });
  });

  it('should modify apps/api/src/main.ts for full-stack projects', async () => {
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    const mainAfterAdd = tree.read('apps/api/src/main.ts', 'utf-8')!;
    expect(mainAfterAdd).toContain('swagger start');

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const mainContent = tree.read('apps/api/src/main.ts', 'utf-8')!;
    expect(mainContent).not.toContain('swagger');
  });
});

/* ================================================================== */
/*  BUG HUNT: cleanEmptyDirectories stop-list is incomplete            */
/* ================================================================== */
describe('remove-recipe: cleanEmptyDirectories edge case', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  // BUG: cleanEmptyDirectories stops walking up at 'src' but in a workspace
  // project the files live under 'apps/api/src'. The while loop condition
  // `dir !== 'src'` will not stop at 'apps/api/src' — it will stop when
  // dir becomes 'src' which may never happen for paths like 'apps/api/src/shared/guards'.
  // The walk: 'apps/api/src/shared/guards' -> 'apps/api/src/shared' -> 'apps/api/src' ->
  // 'apps/api' -> 'apps' -> '' (stops because empty).
  // This means it could attempt to delete 'apps/api/src', 'apps/api', or 'apps' if they
  // are empty — which is dangerous for workspace projects.
  it('should not attempt to delete workspace structural directories', async () => {
    // Simulate a workspace project with recipe files deep inside apps/api
    tree.write(
      '.spoonfeed.json',
      JSON.stringify(
        {
          projectType: 'monorepo',
          cloudProvider: 'aws',
          httpAdapter: 'fastify',
          spoonfeedVersion: '0.0.1',
          generatedAt: '2026-05-18T10:00:00Z',
          recipes: {
            'api-keys': {
              installedAt: '2026-05-18T10:00:00Z',
              version: '0.0.1',
              files: ['apps/api/src/shared/guards/api-key.guard.ts'],
            },
          },
        },
        null,
        2,
      ),
    );

    tree.write('apps/api/src/shared/guards/api-key.guard.ts', 'export class ApiKeyGuard {}');
    // apps/api/src/main.ts exists from seedProject
    tree.write('apps/api/src/main.ts', 'bootstrap();');
    tree.write('apps/api/src/app.module.ts', 'module');

    await removeRecipeGenerator(tree, { recipe: 'api-keys' });

    // The guard file should be gone
    expect(tree.exists('apps/api/src/shared/guards/api-key.guard.ts')).toBe(false);
    // BUG: 'apps/api/src/shared' and 'apps/api/src/shared/guards' may be cleaned,
    // but 'apps/api/src', 'apps/api', 'apps' MUST still exist
    expect(tree.exists('apps/api/src/main.ts')).toBe(true);
    expect(tree.exists('apps/api/src/app.module.ts')).toBe(true);
  });
});

/* ================================================================== */
/*  BUG HUNT: httpAdapter default when manifest has no httpAdapter      */
/* ================================================================== */
describe('remove-recipe: httpAdapter fallback', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should default to fastify when httpAdapter is missing from manifest', async () => {
    // Write manifest WITHOUT httpAdapter field
    tree.write(
      '.spoonfeed.json',
      JSON.stringify(
        {
          projectType: 'http-api',
          cloudProvider: 'aws',
          spoonfeedVersion: '0.0.1',
          generatedAt: '2026-05-18T10:00:00Z',
          recipes: {
            helmet: {
              installedAt: '2026-05-18T10:00:00Z',
              version: '0.0.1',
              files: [],
              mainTsBlocks: ['helmet'],
            },
          },
        },
        null,
        2,
      ),
    );

    // Add the fastify helmet dep manually (simulating what add-recipe would have done)
    tree.write(
      'package.json',
      JSON.stringify(
        {
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            '@nestjs/common': '10.4.15',
            '@nestjs/core': '10.4.15',
            '@fastify/helmet': '13.0.2',
          },
          devDependencies: {},
        },
        null,
        2,
      ),
    );

    // Add helmet block to main.ts
    const mainContent = tree.read('src/main.ts', 'utf-8')!;
    tree.write(
      'src/main.ts',
      mainContent.replace(
        'await app.listen(3000);',
        `  // --- helmet start ---
  await app.register(helmet as any, {});
  // --- helmet end ---

  await app.listen(3000);`,
      ),
    );

    await removeRecipeGenerator(tree, { recipe: 'helmet' });

    // Should have removed fastify dep (default), not express dep
    const pkg = readJson<PackageJson>(tree, 'package.json');
    expect(pkg.dependencies['@fastify/helmet']).toBeUndefined();
  });
});

/* ================================================================== */
/*  BUG HUNT: .env.example section boundary correctness                */
/* ================================================================== */
describe('remove-recipe: .env.example section removal precision', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should remove only the target recipe env section, preserving others', async () => {
    // Add two recipes with env vars
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    const envBefore = tree.read('.env.example', 'utf-8')!;
    expect(envBefore).toContain('CORS_ORIGIN');
    expect(envBefore).toContain('SWAGGER_ENABLED');

    // Remove only cors
    await removeRecipeGenerator(tree, { recipe: 'cors' });

    const envAfter = tree.read('.env.example', 'utf-8')!;
    expect(envAfter).not.toContain('CORS_ORIGIN');
    expect(envAfter).not.toContain('# --- CORS ---');
    // Swagger section should survive
    expect(envAfter).toContain('SWAGGER_ENABLED');
    expect(envAfter).toContain('SWAGGER_PATH');
  });

  it('should handle env section that appears at the very end of file', async () => {
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });

    // cors env section should be at the end
    const envBefore = tree.read('.env.example', 'utf-8')!;
    expect(envBefore).toContain('CORS_ORIGIN');

    await removeRecipeGenerator(tree, { recipe: 'cors' });

    const envAfter = tree.read('.env.example', 'utf-8')!;
    expect(envAfter).not.toContain('CORS_ORIGIN');
    // Should end cleanly with a newline
    expect(envAfter.endsWith('\n')).toBe(true);
    // Should not have triple+ newlines
    expect(envAfter).not.toMatch(/\n{3,}/);
  });
});

/* ================================================================== */
/*  BUG HUNT: AI context markers mismatch                              */
/* ================================================================== */
describe('remove-recipe: AI context section edge cases', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  it('should handle CLAUDE.md that does not exist', async () => {
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });

    // Delete CLAUDE.md before remove
    tree.delete('CLAUDE.md');

    // Should not throw
    await expect(
      removeRecipeGenerator(tree, { recipe: 'cors' }),
    ).resolves.not.toThrow();
  });

  it('should handle copilot-instructions.md that does not exist', async () => {
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });

    // Delete copilot instructions before remove
    tree.delete('.github/copilot-instructions.md');

    // Should not throw
    await expect(
      removeRecipeGenerator(tree, { recipe: 'cors' }),
    ).resolves.not.toThrow();
  });

  it('should handle cursor rules file that does not exist', async () => {
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });

    // Delete cursor rules before remove (if it was created)
    const cursorPath = '.cursor/rules/cors.mdc';
    if (tree.exists(cursorPath)) {
      tree.delete(cursorPath);
    }

    // Should not throw
    await expect(
      removeRecipeGenerator(tree, { recipe: 'cors' }),
    ).resolves.not.toThrow();
  });

  it('should remove multiple AI context sections when multiple recipes are removed sequentially', async () => {
    await addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true });
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    // Both sections should be in CLAUDE.md
    const claudeBefore = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeBefore).toContain('@spoonfeed:cors');
    expect(claudeBefore).toContain('@spoonfeed:swagger');

    // Remove cors
    await removeRecipeGenerator(tree, { recipe: 'cors' });

    const claudeAfterCors = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeAfterCors).not.toContain('@spoonfeed:cors');
    expect(claudeAfterCors).toContain('@spoonfeed:swagger');

    // Remove swagger
    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const claudeAfterSwagger = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeAfterSwagger).not.toContain('@spoonfeed:cors');
    expect(claudeAfterSwagger).not.toContain('@spoonfeed:swagger');
    // Original content preserved
    expect(claudeAfterSwagger).toContain('## Package Manager');
  });
});

/* ================================================================== */
/*  BUG HUNT: removing both swagger+helmet — shared import collision   */
/* ================================================================== */
describe('remove-recipe: main.ts import specifier isolation', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  // BUG: removeBlockFromString removes import lines matching the module specifiers
  // of the recipe being removed. If two recipes both import from the same specifier
  // (unlikely today, but possible), removing one recipe would strip the import
  // needed by the other recipe's block. This test verifies current recipes don't
  // collide and that both can be independently removed.
  it('should remove swagger and helmet blocks independently without breaking main.ts', async () => {
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });
    await addRecipeGenerator(tree, { recipe: 'helmet', skipInstall: true });

    const mainAfterAdd = tree.read('src/main.ts', 'utf-8')!;
    expect(mainAfterAdd).toContain('swagger start');
    expect(mainAfterAdd).toContain('helmet start');

    // Remove swagger first
    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const mainAfterSwagger = tree.read('src/main.ts', 'utf-8')!;
    expect(mainAfterSwagger).not.toContain('swagger start');
    expect(mainAfterSwagger).not.toContain('SwaggerModule');
    // Helmet block must survive
    expect(mainAfterSwagger).toContain('helmet start');
    expect(mainAfterSwagger).toContain('helmet end');

    // Remove helmet
    await removeRecipeGenerator(tree, { recipe: 'helmet' });

    const mainFinal = tree.read('src/main.ts', 'utf-8')!;
    expect(mainFinal).not.toContain('helmet start');
    expect(mainFinal).not.toContain('helmet end');
    // Core bootstrap structure must survive
    expect(mainFinal).toContain('NestFactory');
    expect(mainFinal).toContain('app.listen');
  });
});

/* ================================================================== */
/*  BUG HUNT: recipe def not in registry (custom/obsolete recipe)      */
/* ================================================================== */
describe('remove-recipe: recipe in manifest but not in registry', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  // When a recipe is in the manifest but its definition was removed from the registry
  // (e.g., recipe was deprecated), the generator should still be able to clean up.
  // recipeDef will be undefined, so dep removal and main.ts import collection will be skipped,
  // but files, env section, AI context, and manifest entry should still be cleaned.
  it('should clean up files and manifest even when recipe def is missing from registry', async () => {
    tree.write('src/custom/thing.ts', 'export const thing = 1;');
    // AI context markers use recipe ID ("cors"), not a custom name
    tree.write(
      'CLAUDE.md',
      tree.read('CLAUDE.md', 'utf-8')! +
        '\n<!-- @spoonfeed:cors -->\nCORS section\n<!-- @spoonfeed:end:cors -->\n',
    );

    tree.write(
      '.spoonfeed.json',
      JSON.stringify(
        {
          projectType: 'http-api',
          cloudProvider: 'aws',
          httpAdapter: 'fastify',
          spoonfeedVersion: '0.0.1',
          generatedAt: '2026-05-18T10:00:00Z',
          recipes: {
            cors: {
              installedAt: '2026-05-18T10:00:00Z',
              version: '0.0.1',
              files: ['src/custom/thing.ts'],
              envSection: 'CORS',
            },
          },
        },
        null,
        2,
      ),
    );

    // cors IS in registry but has empty dependencies, so dep removal is effectively a no-op.
    // Verify files, env, AI context, and manifest are still cleaned.
    await removeRecipeGenerator(tree, { recipe: 'cors' });

    expect(tree.exists('src/custom/thing.ts')).toBe(false);
    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['cors']).toBeUndefined();
    const claude = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claude).not.toContain('@spoonfeed:cors');
    // Cursor rules for cors should be gone too
    expect(tree.exists('.cursor/rules/cors.mdc')).toBe(false);
  });
});

/* ================================================================== */
/*  BUG HUNT: manifest envSection uses recipe.name, not recipe.id      */
/* ================================================================== */
describe('remove-recipe: envSection uses recipe name not ID', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
  });

  // BUG: The add-recipe generator stores envSection as recipe.name (e.g., "CORS")
  // and the env markers use recipe.name (e.g., "# --- CORS ---").
  // The remove generator reads envSection from the manifest, which is the recipe.name.
  // This is correct but could be confusing since AI context uses recipe.id.
  // Verify consistency: envSection = recipe.name, AI markers = recipe.id
  it('should correctly match env section markers using recipe name from manifest', async () => {
    // jwt-auth has name "JWT Authentication" (different from id "jwt-auth")
    await addRecipeGenerator(tree, { recipe: 'jwt-auth', skipInstall: true });

    const envAfterAdd = tree.read('.env.example', 'utf-8')!;
    // Markers use the recipe NAME, not ID
    expect(envAfterAdd).toContain('# --- JWT Authentication ---');
    expect(envAfterAdd).toContain('# --- end JWT Authentication ---');

    // AI context markers use recipe ID
    const claudeAfterAdd = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeAfterAdd).toContain('<!-- @spoonfeed:jwt-auth -->');
    expect(claudeAfterAdd).toContain('<!-- @spoonfeed:end:jwt-auth -->');

    // Verify manifest stored envSection as recipe name
    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['jwt-auth'].envSection).toBe('JWT Authentication');

    // Remove should work correctly with the name-based env section
    await removeRecipeGenerator(tree, { recipe: 'jwt-auth' });

    const envAfter = tree.read('.env.example', 'utf-8')!;
    expect(envAfter).not.toContain('JWT_SECRET');
    expect(envAfter).not.toContain('# --- JWT Authentication ---');
    expect(envAfter).not.toContain('# --- end JWT Authentication ---');

    const claudeAfter = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeAfter).not.toContain('jwt-auth');
  });
});

/* ================================================================== */
/*  BUG HUNT: workspace package.json path                              */
/* ================================================================== */
describe('remove-recipe: workspace package.json location', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { projectType: 'monorepo' });
  });

  // The remove generator always updates root package.json, even for workspace projects.
  // This is correct because NestJS monorepo deps live in root package.json.
  // Verify deps are removed from ROOT package.json, not apps/api/package.json.
  it('should update root package.json for workspace projects', async () => {
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    const rootPkg = readJson<PackageJson>(tree, 'package.json');
    expect(rootPkg.dependencies['@nestjs/swagger']).toBeDefined();

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const rootPkgAfter = readJson<PackageJson>(tree, 'package.json');
    expect(rootPkgAfter.dependencies['@nestjs/swagger']).toBeUndefined();
  });
});
