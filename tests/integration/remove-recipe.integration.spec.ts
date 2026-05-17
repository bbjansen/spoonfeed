import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson } from '@nx/devkit';
import addRecipeGenerator from '@spoonfeeder/generators/add-recipe/generator';
import removeRecipeGenerator from '@spoonfeeder/generators/remove-recipe/generator';

type ManifestJson = {
  projectType: string;
  spoonfeederVersion: string;
  recipes: Record<string, { files: string[]; moduleImport?: unknown; mainTsBlocks?: string[] }>;
  [key: string]: unknown;
};

type PackageJson = {
  name: string;
  version?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/**
 * Creates a minimal project tree that looks like a spoonfeeder-generated project.
 * Includes package.json, .spoonfeeder.json, app.module.ts, main.ts, .env.example,
 * CLAUDE.md, .github/copilot-instructions.md.
 */
function seedFullProject(tree: Tree): void {
  tree.write(
    '.spoonfeeder.json',
    JSON.stringify(
      {
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeederVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
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

describe('remove-recipe integration (add then remove round-trip)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedFullProject(tree);
  });

  it('should clean up manifest and package.json after add + remove of swagger', async () => {
    const pkgBefore = readJson<PackageJson>(tree, 'package.json');
    const claudeBefore = tree.read('CLAUDE.md', 'utf-8')!;

    // Add swagger
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });

    // Verify it was added
    const manifestAfterAdd = readJson<ManifestJson>(tree, '.spoonfeeder.json');
    expect(manifestAfterAdd.recipes['swagger']).toBeDefined();

    const pkgAfterAdd = readJson<PackageJson>(tree, 'package.json');
    expect(pkgAfterAdd.dependencies['@nestjs/swagger']).toBeDefined();

    // Remove swagger
    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    // Verify manifest is clean
    const manifestAfterRemove = readJson<ManifestJson>(tree, '.spoonfeeder.json');
    expect(manifestAfterRemove.recipes['swagger']).toBeUndefined();
    expect(Object.keys(manifestAfterRemove.recipes)).toHaveLength(0);

    // Verify package.json dependencies are clean
    const pkgAfterRemove = readJson<PackageJson>(tree, 'package.json');
    expect(pkgAfterRemove.dependencies['@nestjs/swagger']).toBeUndefined();

    // Core dependencies should remain
    expect(pkgAfterRemove.dependencies['@nestjs/common']).toBe(
      pkgBefore.dependencies['@nestjs/common'],
    );
    expect(pkgAfterRemove.dependencies['@nestjs/core']).toBe(
      pkgBefore.dependencies['@nestjs/core'],
    );

    // CLAUDE.md should have swagger section removed
    const claudeAfter = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeAfter).not.toContain('@spoonfeeder:swagger');
    expect(claudeAfter).toContain('## Package Manager');
    // Original CLAUDE.md content should be preserved (trimming/formatting may differ slightly)
    expect(claudeAfter).toContain(claudeBefore.trim().split('\n')[0]);
  });

  it('should clean up manifest and package.json after add + remove of pino', async () => {
    // Add pino
    await addRecipeGenerator(tree, { recipe: 'pino', skipInstall: true });

    const manifestAfterAdd = readJson<ManifestJson>(tree, '.spoonfeeder.json');
    expect(manifestAfterAdd.recipes['pino']).toBeDefined();

    // Remove pino
    await removeRecipeGenerator(tree, { recipe: 'pino' });

    const manifestAfterRemove = readJson<ManifestJson>(tree, '.spoonfeeder.json');
    expect(manifestAfterRemove.recipes['pino']).toBeUndefined();

    // Pino deps should be gone
    const pkgAfterRemove = readJson<PackageJson>(tree, 'package.json');
    expect(pkgAfterRemove.dependencies['nestjs-pino']).toBeUndefined();
    expect(pkgAfterRemove.dependencies['pino']).toBeUndefined();
  });

  it('should handle removing one recipe when multiple are installed', async () => {
    // Add two recipes
    await addRecipeGenerator(tree, { recipe: 'swagger', skipInstall: true });
    await addRecipeGenerator(tree, { recipe: 'helmet', skipInstall: true });

    // Remove only swagger
    await removeRecipeGenerator(tree, { recipe: 'swagger' });

    const manifest = readJson<ManifestJson>(tree, '.spoonfeeder.json');
    expect(manifest.recipes['swagger']).toBeUndefined();
    expect(manifest.recipes['helmet']).toBeDefined();

    // Helmet deps should remain
    const pkg = readJson<PackageJson>(tree, 'package.json');
    expect(pkg.dependencies['@fastify/helmet']).toBeDefined();
  });
});
