import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson, updateJson } from '@nx/devkit';
import removeRecipeGenerator from '@spoonfeeder/generators/remove-recipe/generator';

type ManifestJson = {
  projectType: string;
  recipes: Record<string, unknown>;
  [key: string]: unknown;
};

type PackageJson = {
  name: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

function typedReadJson<T>(tree: Tree, path: string): T {
  return readJson(tree, path) as T;
}

/**
 * Creates a minimal project tree with a manifest that has the given recipe installed.
 */
function seedProject(
  tree: Tree,
  recipeId: string,
  recipeEntry: Record<string, unknown> = {},
): void {
  tree.write(
    '.spoonfeeder.json',
    JSON.stringify(
      {
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeederVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
        recipes: {
          [recipeId]: {
            installedAt: '2026-05-12T10:05:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
            envSection: null,
            moduleImport: null,
            ...recipeEntry,
          },
        },
      },
      null,
      2,
    ),
  );

  if (!tree.exists('package.json')) {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'test-project', dependencies: {}, devDependencies: {} }, null, 2),
    );
  }
}

describe('remove-recipe generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should throw if manifest does not exist', async () => {
    await expect(removeRecipeGenerator(tree, { recipe: 'swagger' })).rejects.toThrow(
      '.spoonfeeder.json not found',
    );
  });

  it('should throw if recipe is not installed', async () => {
    seedProject(tree, 'pino', {});

    await expect(removeRecipeGenerator(tree, { recipe: 'swagger' })).rejects.toThrow(
      "Recipe 'swagger' is not installed",
    );
  });

  it('should remove recipe files listed in the manifest', async () => {
    const files = ['src/infrastructure/swagger/swagger.config.ts'];
    seedProject(tree, 'swagger', { files });
    tree.write(files[0], 'export const swaggerConfig = {};');

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    expect(tree.exists(files[0])).toBe(false);
  });

  it('should remove recipe from manifest after removal', async () => {
    seedProject(tree, 'swagger', {});

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const manifest = typedReadJson<ManifestJson>(tree, '.spoonfeeder.json');
    expect(manifest.recipes['swagger']).toBeUndefined();
  });

  it('should remove module import from app.module.ts', async () => {
    seedProject(tree, 'swagger', {
      moduleImport: {
        moduleName: 'SwaggerModule',
        importPath: '@/infrastructure/swagger/swagger.module',
      },
    });

    tree.write(
      'src/app.module.ts',
      `import { Module } from '@nestjs/common';
import { SwaggerModule } from '@/infrastructure/swagger/swagger.module';

@Module({
  imports: [SwaggerModule],
})
export class AppModule {}
`,
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const content = tree.read('src/app.module.ts', 'utf-8')!;
    expect(content).not.toContain('SwaggerModule');
    expect(content).not.toContain('@/infrastructure/swagger/swagger.module');
    expect(content).toContain('@Module');
  });

  it('should remove main.ts blocks', async () => {
    seedProject(tree, 'swagger', {
      mainTsBlocks: ['swagger-setup'],
    });

    tree.write(
      'src/main.ts',
      `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- swagger-setup start ---
  const swaggerConfig = {};
  // --- swagger-setup end ---

  await app.listen(3000);
}
bootstrap();
`,
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const content = tree.read('src/main.ts', 'utf-8')!;
    expect(content).not.toContain('swagger-setup');
    expect(content).not.toContain('swaggerConfig');
    expect(content).toContain('await app.listen(3000)');
  });

  it('should remove env section from .env.example', async () => {
    seedProject(tree, 'swagger', {
      envSection: 'Swagger / OpenAPI',
    });

    tree.write(
      '.env.example',
      `# Application
PORT=3000
NODE_ENV=development

# --- Swagger / OpenAPI ---
# Enable Swagger UI
SWAGGER_ENABLED=true
# Swagger UI URL path
SWAGGER_PATH=api/docs
# --- end Swagger / OpenAPI ---
`,
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const content = tree.read('.env.example', 'utf-8')!;
    expect(content).not.toContain('SWAGGER_ENABLED');
    expect(content).not.toContain('SWAGGER_PATH');
    expect(content).toContain('PORT=3000');
  });

  it('should remove AI context section from CLAUDE.md', async () => {
    seedProject(tree, 'swagger', {});

    tree.write(
      'CLAUDE.md',
      `# CLAUDE.md

## Package Manager

Always use pnpm.

<!-- @spoonfeeder:swagger -->
## Swagger / OpenAPI
Swagger UI is available at /{SWAGGER_PATH}.
<!-- @spoonfeeder:end:swagger -->
`,
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const content = tree.read('CLAUDE.md', 'utf-8')!;
    expect(content).not.toContain('Swagger');
    expect(content).toContain('## Package Manager');
  });

  it('should remove dependencies from package.json', async () => {
    seedProject(tree, 'swagger', {});
    updateJson(tree, 'package.json', (json: PackageJson) => {
      json.dependencies['@nestjs/swagger'] = '8.1.0';
      return json;
    });

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const pkg = typedReadJson<PackageJson>(tree, 'package.json');
    expect(pkg.dependencies['@nestjs/swagger']).toBeUndefined();
  });

  it('should not remove shared dependencies used by other installed recipes', async () => {
    const manifest = {
      projectType: 'http-api',
      cloudProvider: 'aws',
      spoonfeederVersion: '0.0.1',
      generatedAt: '2026-05-12T10:00:00Z',
      recipes: {
        swagger: {
          installedAt: '2026-05-12T10:05:00Z',
          version: '0.0.1',
          files: [],
          mainTsBlocks: [],
          envSection: null,
          moduleImport: null,
        },
        pino: {
          installedAt: '2026-05-12T10:10:00Z',
          version: '0.0.1',
          files: [],
          mainTsBlocks: [],
          envSection: null,
          moduleImport: null,
        },
      },
    };

    tree.write('.spoonfeeder.json', JSON.stringify(manifest, null, 2));
    tree.write(
      'package.json',
      JSON.stringify(
        {
          name: 'test-project',
          dependencies: { 'nestjs-pino': '4.2.0', pino: '9.6.0' },
          devDependencies: { 'pino-pretty': '13.0.0' },
        },
        null,
        2,
      ),
    );

    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const pkg = typedReadJson<PackageJson>(tree, 'package.json');
    // pino deps should remain since pino recipe is still installed
    expect(pkg.dependencies['nestjs-pino']).toBe('4.2.0');
    expect(pkg.dependencies['pino']).toBe('9.6.0');
  });

  describe('dependency checking', () => {
    it('should throw when another installed recipe depends on the target', async () => {
      // auth-flows requires jwt-auth in the actual recipe definitions
      const manifest = {
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeederVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
        recipes: {
          'jwt-auth': {
            installedAt: '2026-05-12T10:05:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
          },
          'auth-flows': {
            installedAt: '2026-05-12T10:10:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
          },
        },
      };

      tree.write('.spoonfeeder.json', JSON.stringify(manifest, null, 2));
      tree.write(
        'package.json',
        JSON.stringify({ name: 'test', dependencies: {}, devDependencies: {} }, null, 2),
      );

      await expect(removeRecipeGenerator(tree, { recipe: 'jwt-auth' })).rejects.toThrow(
        "Cannot remove 'jwt-auth'",
      );
    });

    it('should allow removal with --force even when dependents exist', async () => {
      // auth-flows requires jwt-auth in the actual recipe definitions
      const manifest = {
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeederVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
        recipes: {
          'jwt-auth': {
            installedAt: '2026-05-12T10:05:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
          },
          'auth-flows': {
            installedAt: '2026-05-12T10:10:00Z',
            version: '0.0.1',
            files: [],
            mainTsBlocks: [],
          },
        },
      };

      tree.write('.spoonfeeder.json', JSON.stringify(manifest, null, 2));
      tree.write(
        'package.json',
        JSON.stringify({ name: 'test', dependencies: {}, devDependencies: {} }, null, 2),
      );

      await removeRecipeGenerator(tree, { recipe: 'jwt-auth', force: true });

      const updated = typedReadJson<ManifestJson>(tree, '.spoonfeeder.json');
      expect(updated.recipes['jwt-auth']).toBeUndefined();
      expect(updated.recipes['auth-flows']).toBeDefined();
    });
  });
});
