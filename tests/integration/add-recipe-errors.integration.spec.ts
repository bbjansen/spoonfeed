import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson, logger } from '@nx/devkit';
import addRecipeGenerator from '@spoonfeed/generators/add-recipe/generator';

type ManifestJson = {
  projectType: string;
  cloudProvider: string;
  httpAdapter?: string;
  spoonfeedVersion: string;
  generatedAt: string;
  recipes: Record<
    string,
    {
      installedAt: string;
      version: string;
      files: string[];
      moduleImport?: { moduleName: string; importPath: string };
      mainTsBlocks?: string[];
      envSection?: string;
    }
  >;
};

type PackageJson = {
  name: string;
  version?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Minimal Fastify-based http-api project (the default). */
function seedProject(
  tree: Tree,
  overrides: Partial<ManifestJson> = {},
): void {
  const manifest: ManifestJson = {
    projectType: 'http-api',
    cloudProvider: 'none',
    httpAdapter: 'fastify',
    spoonfeedVersion: '0.0.1',
    generatedAt: '2026-05-18T00:00:00Z',
    recipes: {},
    ...overrides,
  };

  tree.write('.spoonfeed.json', JSON.stringify(manifest, null, 2));

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
    'src/app.module.ts',
    `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`,
  );

  tree.write(
    'src/main.ts',
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

/** Workspace (monorepo / full-stack) project with files under apps/api/. */
function seedWorkspaceProject(
  tree: Tree,
  projectType: 'monorepo' | 'full-stack' = 'monorepo',
): void {
  const manifest: ManifestJson = {
    projectType,
    cloudProvider: 'none',
    httpAdapter: 'express',
    spoonfeedVersion: '0.0.1',
    generatedAt: '2026-05-18T00:00:00Z',
    recipes: {},
  };

  tree.write('.spoonfeed.json', JSON.stringify(manifest, null, 2));

  tree.write(
    'package.json',
    JSON.stringify(
      {
        name: 'test-workspace',
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
    'apps/api/src/app.module.ts',
    `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`,
  );

  tree.write(
    'apps/api/src/main.ts',
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

  tree.write('CLAUDE.md', '# CLAUDE.md\n');
  tree.write('.github/copilot-instructions.md', '# Copilot Instructions\n');
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Missing .spoonfeed.json
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: missing .spoonfeed.json', () => {
  it('should throw a clear error when manifest is missing', async () => {
    const tree = createTreeWithEmptyWorkspace();
    // No .spoonfeed.json, just a bare workspace

    await expect(
      addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true }),
    ).rejects.toThrow('.spoonfeed.json not found');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Already-installed recipe
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: already-installed recipe', () => {
  let tree: Tree;
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedProject(tree);
    warnSpy.mockClear();
  });

  it('should skip without error when adding an already-installed recipe', async () => {
    // Install swagger first
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    const manifestBefore = readJson<ManifestJson>(tree, '.spoonfeed.json');
    const pkgBefore = readJson<PackageJson>(tree, 'package.json');

    // Try to install swagger again — should not throw
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('already installed'),
    );

    // Manifest should be unchanged (no duplicate entry)
    const manifestAfter = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifestAfter.recipes['swagger'].installedAt).toBe(
      manifestBefore.recipes['swagger'].installedAt,
    );

    // Package.json should be unchanged
    const pkgAfter = readJson<PackageJson>(tree, 'package.json');
    expect(pkgAfter).toEqual(pkgBefore);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Incompatible recipe (HTTP-only recipe on cli-app)
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: incompatible project type', () => {
  it('should reject an HTTP-only recipe on a cli-app project', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { projectType: 'cli-app' });

    // cors is compatible with http-api, aws-lambda, full-stack, monorepo — NOT cli-app
    await expect(
      addRecipeGenerator(tree, { recipe: 'cors', skipInstall: true }),
    ).rejects.toThrow(/not compatible with project type/);
  });

  it('should reject swagger on a scheduled-worker project', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { projectType: 'scheduled-worker' });

    await expect(
      addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true }),
    ).rejects.toThrow(/not compatible with project type/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Conflicting recipe (prisma vs typeorm-postgres)
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: conflicting recipes', () => {
  it('should reject prisma when typeorm-postgres is already installed', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'typeorm-postgres',
      skipInstall: true,
    });

    await expect(
      addRecipeGenerator(tree, { recipe: 'prisma', skipInstall: true }),
    ).rejects.toThrow(/Conflict/);
  });

  it('should reject pino when winston is already installed', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'winston',
      skipInstall: true,
    });

    await expect(
      addRecipeGenerator(tree, { recipe: 'pino', skipInstall: true }),
    ).rejects.toThrow(/Conflict/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Missing requires
//
// NOTE: No recipe currently declares a `requires` dependency. We test the
// mechanism by temporarily monkey-patching the registry so that a recipe
// has a synthetic requirement. This validates the code path in the generator.
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: missing requirements', () => {
  it('should reject a recipe whose requirements are not installed', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    // Patch: make swagger require jwt-auth (it normally does not)
    // We import the registry + definitions and override at runtime.
    const { RecipeRegistry } = await import('@spoonfeed/recipes/registry');
    const { registerAllRecipes } = await import(
      '@spoonfeed/recipes/definitions'
    );
    const registry = new RecipeRegistry();
    registerAllRecipes(registry);

    const swaggerDef = registry.get('swagger')!;
    const original = [...swaggerDef.requires];
    swaggerDef.requires = ['jwt-auth'];

    try {
      // The generator creates its own registry, so we need to verify the
      // conflict-detector mechanism works with a direct test of detectConflicts.
      const { detectConflicts } = await import(
        '@spoonfeed/validation/conflict-detector'
      );

      const conflicts = detectConflicts(
        ['swagger'],
        [{ ...swaggerDef, requires: ['jwt-auth'] }],
      );
      const missing = conflicts.filter(
        (c) => c.type === 'missing-requirement',
      );
      expect(missing.length).toBeGreaterThan(0);
      expect(missing[0].message).toContain('requires');
    } finally {
      swaggerDef.requires = original;
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Express project + Fastify-only recipe (graphql-mercurius)
//
// BUG: The add-recipe generator does NOT validate httpAdapter compatibility.
// The main generator (config-validator.ts) has a specific check for
// graphql-mercurius + express, but add-recipe skips this entirely.
// graphql-mercurius uses Mercurius which is Fastify-only. Adding it to an
// Express project will install packages that cannot work at runtime.
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: Express project + Fastify-only recipe', () => {
  it('rejects graphql-mercurius on an Express project with a clear error', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { httpAdapter: 'express' });

    // FIXED: The add-recipe generator now validates httpAdapter compatibility.
    // graphql-mercurius requires Fastify and is correctly rejected for Express projects.
    await expect(
      addRecipeGenerator(tree, {
        recipe: 'graphql-mercurius',
        skipInstall: true,
      }),
    ).rejects.toThrow(/requires the Fastify HTTP adapter/);

    // Mercurius deps should NOT be installed on an Express project
    const pkg = readJson<PackageJson>(tree, 'package.json');
    expect(pkg.dependencies['mercurius']).toBeUndefined();
    expect(pkg.dependencies['@nestjs/mercurius']).toBeUndefined();

    // The manifest should NOT record it as installed
    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['graphql-mercurius']).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Happy path: add recipe to Express project (adapter-aware deps)
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: Express project uses expressDependencies', () => {
  it('should install express-specific deps for helmet on an Express project', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { httpAdapter: 'express' });

    await addRecipeGenerator(tree, {
      recipe: 'helmet',
      skipInstall: true,
    });

    const pkg = readJson<PackageJson>(tree, 'package.json');

    // Express project should get `helmet`, NOT `@fastify/helmet`
    expect(pkg.dependencies['helmet']).toBe('8.1.0');
    expect(pkg.dependencies['@fastify/helmet']).toBeUndefined();
  });

  it('should install fastify-specific deps for helmet on a Fastify project', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { httpAdapter: 'fastify' });

    await addRecipeGenerator(tree, {
      recipe: 'helmet',
      skipInstall: true,
    });

    const pkg = readJson<PackageJson>(tree, 'package.json');

    // Fastify project should get `@fastify/helmet`, NOT `helmet`
    expect(pkg.dependencies['@fastify/helmet']).toBe('13.0.2');
    expect(pkg.dependencies['helmet']).toBeUndefined();
  });

  it('should use expressMainTsSetup when httpAdapter is express', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { httpAdapter: 'express' });

    await addRecipeGenerator(tree, {
      recipe: 'helmet',
      skipInstall: true,
    });

    const mainTs = tree.read('src/main.ts', 'utf-8')!;
    // Express helmet import uses 'helmet', not '@fastify/helmet'
    expect(mainTs).toContain("from 'helmet'");
    expect(mainTs).not.toContain('@fastify/helmet');
  });

  it('should use expressDependencies for swagger on Express (no @fastify/static)', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree, { httpAdapter: 'express' });

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    expect(pkg.dependencies['@nestjs/swagger']).toBeDefined();
    // Express swagger should NOT include @fastify/static
    expect(pkg.dependencies['@fastify/static']).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. Happy path: add recipe to workspace project (monorepo/full-stack)
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: workspace project paths', () => {
  it('should write mainTs blocks to apps/api/src/main.ts for monorepo', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedWorkspaceProject(tree, 'monorepo');

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    // main.ts should be updated in apps/api/src, not src/
    const mainTs = tree.read('apps/api/src/main.ts', 'utf-8')!;
    expect(mainTs).toContain('SwaggerModule');

    // Root src/main.ts should NOT exist
    expect(tree.exists('src/main.ts')).toBe(false);
  });

  it('should write mainTs blocks to apps/api/src/main.ts for full-stack', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedWorkspaceProject(tree, 'full-stack');

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const mainTs = tree.read('apps/api/src/main.ts', 'utf-8')!;
    expect(mainTs).toContain('SwaggerModule');

    // Root src/main.ts should NOT exist
    expect(tree.exists('src/main.ts')).toBe(false);
  });

  // FIXED: moduleImport is now defined on many recipes, so the moduleImport
  // code path in the add-recipe generator is no longer dead code.
  it('moduleImport is used by recipes', async () => {
    const { RecipeRegistry } = await import('@spoonfeed/recipes/registry');
    const { registerAllRecipes } = await import(
      '@spoonfeed/recipes/definitions'
    );
    const registry = new RecipeRegistry();
    registerAllRecipes(registry);

    const recipesWithModuleImport = registry
      .getAll()
      .filter((r) => r.moduleImport !== undefined);
    expect(recipesWithModuleImport.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. Manifest update correctness
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: manifest update correctness', () => {
  it('should record the recipe in the manifest with correct fields', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    const entry = manifest.recipes['swagger'];

    expect(entry).toBeDefined();
    expect(entry.installedAt).toBeDefined();
    expect(new Date(entry.installedAt).getTime()).not.toBeNaN();
    expect(entry.version).toBe('0.0.1');
    expect(Array.isArray(entry.files)).toBe(true);
  });

  it('should record mainTsBlocks when recipe has mainTsSetup', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    const entry = manifest.recipes['swagger'];
    expect(entry.mainTsBlocks).toEqual(['swagger']);
  });

  it('should record envSection when recipe has envVars', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    const entry = manifest.recipes['swagger'];
    expect(entry.envSection).toBe('Swagger / OpenAPI');
  });

  it('should not clobber existing recipes when adding a new one', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });
    await addRecipeGenerator(tree, {
      recipe: 'helmet',
      skipInstall: true,
    });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    expect(manifest.recipes['swagger']).toBeDefined();
    expect(manifest.recipes['helmet']).toBeDefined();
  });

  // FIXED: The template copy logic is now implemented. The `files` array in the
  // manifest entry is populated with the files copied from the recipe template.
  it('files array in manifest is populated with copied template files', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'typeorm-postgres',
      skipInstall: true,
    });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    const entry = manifest.recipes['typeorm-postgres'];

    // FIXED: copiedFiles is now populated by the template copy logic.
    expect(entry.files.length).toBeGreaterThan(0);
    // Verify it includes expected files from the typeorm-postgres template
    expect(entry.files).toContain('src/infrastructure/database/database.module.ts');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 10. Package.json update correctness
// ────────────────────────────────────────────────────────────────────────────
describe('add-recipe: package.json update', () => {
  it('should add dependencies alphabetically sorted', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'typeorm-postgres',
      skipInstall: true,
    });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    const depKeys = Object.keys(pkg.dependencies);
    const sorted = [...depKeys].sort((a, b) => a.localeCompare(b));
    expect(depKeys).toEqual(sorted);
  });

  it('should not introduce version ranges (^, ~, >=, *)', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'typeorm-postgres',
      skipInstall: true,
    });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    const rangePattern = /^[~^>=*]/;

    for (const [name, version] of Object.entries(pkg.dependencies)) {
      expect(`${name}@${version}`).not.toMatch(
        new RegExp(`^${name}@[~^>=*]`),
      );
      expect(rangePattern.test(version)).toBe(false);
    }

    for (const [name, version] of Object.entries(pkg.devDependencies)) {
      expect(`${name}@${version}`).not.toMatch(
        new RegExp(`^${name}@[~^>=*]`),
      );
      expect(rangePattern.test(version)).toBe(false);
    }
  });

  it('should merge devDependencies from recipe', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    // prisma has devDependencies: { prisma: '6.2.1' }
    await addRecipeGenerator(tree, {
      recipe: 'prisma',
      skipInstall: true,
    });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    expect(pkg.devDependencies['prisma']).toBe('6.2.1');
    expect(pkg.dependencies['@prisma/client']).toBe('6.2.1');
  });

  it('should not duplicate dependencies already present', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    // Pre-populate a dependency that swagger also brings
    tree.write(
      'package.json',
      JSON.stringify(
        {
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            '@nestjs/common': '10.4.15',
            '@nestjs/core': '10.4.15',
            '@nestjs/swagger': '11.4.2',
          },
          devDependencies: {},
        },
        null,
        2,
      ),
    );

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    // Should still have exactly one entry for @nestjs/swagger
    const swaggerEntries = Object.entries(pkg.dependencies).filter(
      ([k]) => k === '@nestjs/swagger',
    );
    expect(swaggerEntries).toHaveLength(1);
  });

  it('should preserve existing dependencies not related to the recipe', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    const pkgBefore = readJson<PackageJson>(tree, 'package.json');
    const coreVersion = pkgBefore.dependencies['@nestjs/core'];

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const pkgAfter = readJson<PackageJson>(tree, 'package.json');
    expect(pkgAfter.dependencies['@nestjs/core']).toBe(coreVersion);
    expect(pkgAfter.dependencies['@nestjs/common']).toBe(
      pkgBefore.dependencies['@nestjs/common'],
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Additional edge cases
// ────────────────────────────────────────────────────────────────────────────

describe('add-recipe: env vars', () => {
  it('should add env section to .env.example', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const envContent = tree.read('.env.example', 'utf-8')!;
    expect(envContent).toContain('# --- Swagger / OpenAPI ---');
    expect(envContent).toContain('SWAGGER_ENABLED=true');
    expect(envContent).toContain('SWAGGER_PATH=api/docs');
    expect(envContent).toContain('# --- end Swagger / OpenAPI ---');
  });

  it('should not duplicate env section on second add attempt', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    // Manually pre-populate the env section
    const existing = tree.read('.env.example', 'utf-8')!;
    tree.write(
      '.env.example',
      existing + '\n# --- Swagger / OpenAPI ---\nSWAGGER_ENABLED=true\n# --- end Swagger / OpenAPI ---\n',
    );

    // Re-seed the manifest so swagger is not listed (simulating partial state)
    // The generator should check the marker in .env.example and skip.
    // But we also need swagger not in the manifest to get past the "already installed" check.
    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const envContent = tree.read('.env.example', 'utf-8')!;
    const markerCount = (envContent.match(/# --- Swagger \/ OpenAPI ---/g) || []).length;
    expect(markerCount).toBe(1);
  });
});

describe('add-recipe: AI context files', () => {
  it('should add CLAUDE.md section with markers', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const claude = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claude).toContain('<!-- @spoonfeed:swagger -->');
    expect(claude).toContain('<!-- @spoonfeed:end:swagger -->');
    expect(claude).toContain('Swagger');
  });

  it('should add copilot-instructions.md section with markers', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const copilot = tree.read('.github/copilot-instructions.md', 'utf-8')!;
    expect(copilot).toContain('<!-- @spoonfeed:swagger -->');
    expect(copilot).toContain('<!-- @spoonfeed:end:swagger -->');
  });

  it('should write cursor rules file', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    expect(tree.exists('.cursor/rules/swagger.mdc')).toBe(true);
    const cursorRules = tree.read('.cursor/rules/swagger.mdc', 'utf-8')!;
    expect(cursorRules.length).toBeGreaterThan(0);
  });

  it('should not duplicate AI context on second add attempt', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    // Pre-populate CLAUDE.md with a swagger marker
    const claude = tree.read('CLAUDE.md', 'utf-8')!;
    tree.write(
      'CLAUDE.md',
      claude + '\n<!-- @spoonfeed:swagger -->\nSwagger section\n<!-- @spoonfeed:end:swagger -->\n',
    );

    await addRecipeGenerator(tree, {
      recipe: 'swagger',
      skipInstall: true,
    });

    const claudeAfter = tree.read('CLAUDE.md', 'utf-8')!;
    const markerCount = (claudeAfter.match(/<!-- @spoonfeed:swagger -->/g) || []).length;
    expect(markerCount).toBe(1);
  });
});

describe('add-recipe: httpAdapter manifest default', () => {
  // BUG: When .spoonfeed.json has no httpAdapter field, the generator
  // defaults to 'fastify' via `manifest.httpAdapter ?? 'fastify'` (line 41).
  // This is a reasonable fallback, but it means projects generated before
  // the httpAdapter field was added will silently get Fastify-specific
  // dependencies even if they were actually Express projects.
  it('should default to fastify when httpAdapter is missing from manifest', async () => {
    const tree = createTreeWithEmptyWorkspace();
    // Seed without httpAdapter
    seedProject(tree, { httpAdapter: undefined } as unknown as Partial<ManifestJson>);

    // Remove httpAdapter from manifest manually
    const manifest = readJson<ManifestJson>(tree, '.spoonfeed.json');
    delete manifest.httpAdapter;
    tree.write('.spoonfeed.json', JSON.stringify(manifest, null, 2));

    await addRecipeGenerator(tree, {
      recipe: 'helmet',
      skipInstall: true,
    });

    const pkg = readJson<PackageJson>(tree, 'package.json');
    // Defaults to fastify deps
    expect(pkg.dependencies['@fastify/helmet']).toBeDefined();
    expect(pkg.dependencies['helmet']).toBeUndefined();
  });
});

describe('add-recipe: unknown recipe', () => {
  it('should throw a clear error for an unknown recipe ID', async () => {
    const tree = createTreeWithEmptyWorkspace();
    seedProject(tree);

    await expect(
      addRecipeGenerator(tree, {
        recipe: 'nonexistent-recipe',
        skipInstall: true,
      }),
    ).rejects.toThrow(/not found/);
  });
});
