import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson } from '@nx/devkit';
import migrateRecipeGenerator from '@spoonfeeder/generators/migrate-recipe/generator';

function typedReadJson<T>(tree: Tree, path: string): T {
  return readJson(tree, path) as T;
}

/**
 * E2E test: migrate typeorm-postgres -> drizzle-postgres.
 *
 * This test simulates a full lifecycle:
 *   1. Start with a project that has typeorm-postgres installed.
 *   2. Run migrate-recipe to swap to drizzle-postgres.
 *   3. Verify the project tree is consistent and would build.
 */
describe('migrate-recipe E2E: typeorm-postgres -> drizzle-postgres', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    // Seed a realistic project structure
    tree.write(
      'package.json',
      JSON.stringify(
        {
          name: 'e2e-test-project',
          version: '0.0.1',
          scripts: {
            build: 'tsc -p tsconfig.build.json',
          },
          dependencies: {
            '@nestjs/common': '10.4.15',
            '@nestjs/core': '10.4.15',
            '@nestjs/platform-express': '10.4.15',
            '@nestjs/typeorm': '10.0.2',
            typeorm: '0.3.20',
            pg: '8.13.1',
            'reflect-metadata': '0.2.2',
            rxjs: '7.8.1',
          },
          devDependencies: {
            '@nestjs/cli': '10.4.9',
            '@types/node': '22.10.5',
            typescript: '5.7.3',
          },
        },
        null,
        2,
      ),
    );

    tree.write(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          module: 'commonjs',
          target: 'ES2021',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          paths: { '@/*': ['src/*'] },
        },
      }),
    );

    tree.write(
      'tsconfig.build.json',
      JSON.stringify({
        extends: './tsconfig.json',
        exclude: ['node_modules', 'dist', '**/*.spec.ts'],
      }),
    );

    tree.write(
      '.spoonfeeder.json',
      JSON.stringify(
        {
          projectType: 'http-api',
          cloudProvider: 'aws',
          spoonfeederVersion: '0.0.1',
          generatedAt: '2026-05-12T10:00:00Z',
          recipes: {
            'typeorm-postgres': {
              installedAt: '2026-05-12T10:05:00Z',
              version: '0.0.1',
              files: [
                'src/infrastructure/database/database.module.ts',
                'src/infrastructure/database/typeorm.config.ts',
              ],
              mainTsBlocks: [],
              envSection: 'TypeORM + PostgreSQL',
              moduleImport: {
                moduleName: 'DatabaseModule',
                importPath: '@/infrastructure/database/database.module',
              },
            },
          },
        },
        null,
        2,
      ),
    );

    tree.write(
      '.env.example',
      [
        '# Application',
        'PORT=3000',
        'NODE_ENV=development',
        '',
        '# --- TypeORM + PostgreSQL ---',
        '# PostgreSQL host',
        'DB_HOST=localhost',
        '# PostgreSQL port',
        'DB_PORT=5432',
        '# PostgreSQL username',
        'DB_USERNAME=postgres',
        '# PostgreSQL password',
        'DB_PASSWORD=postgres',
        '# PostgreSQL database name',
        'DB_NAME=app',
        '# --- end TypeORM + PostgreSQL ---',
        '',
      ].join('\n'),
    );

    tree.write(
      'CLAUDE.md',
      [
        '# CLAUDE.md',
        '',
        '## Package Manager',
        '',
        'Always use pnpm.',
        '',
        '<!-- @spoonfeeder:typeorm-postgres -->',
        '## TypeORM + PostgreSQL',
        'Entities live in `src/<module>/entities/`. Use migrations for schema changes.',
        '<!-- @spoonfeeder:end:typeorm-postgres -->',
        '',
      ].join('\n'),
    );

    tree.write(
      'src/app.module.ts',
      [
        "import { Module } from '@nestjs/common';",
        "import { DatabaseModule } from '@/infrastructure/database/database.module';",
        '',
        '@Module({',
        '  imports: [DatabaseModule],',
        '})',
        'export class AppModule {}',
        '',
      ].join('\n'),
    );

    tree.write(
      'src/infrastructure/database/database.module.ts',
      [
        "import { Module } from '@nestjs/common';",
        "import { TypeOrmModule } from '@nestjs/typeorm';",
        '',
        '@Module({',
        '  imports: [TypeOrmModule.forRoot({})],',
        '})',
        'export class DatabaseModule {}',
        '',
      ].join('\n'),
    );

    tree.write(
      'src/infrastructure/database/typeorm.config.ts',
      "import { DataSource } from 'typeorm';\nexport default new DataSource({});\n",
    );

    tree.write(
      'src/main.ts',
      [
        "import { NestFactory } from '@nestjs/core';",
        "import { AppModule } from './app.module';",
        '',
        'async function bootstrap() {',
        '  const app = await NestFactory.create(AppModule);',
        '  await app.listen(3000);',
        '}',
        'bootstrap();',
        '',
      ].join('\n'),
    );
  });

  it('should migrate from typeorm-postgres to drizzle-postgres', async () => {
    await migrateRecipeGenerator(tree, {
      from: 'typeorm-postgres',
      to: 'drizzle-postgres',
    });

    // 1. Manifest: old recipe removed, new recipe added
    const manifest = typedReadJson<{ recipes: Record<string, { version: string }> }>(
      tree,
      '.spoonfeeder.json',
    );
    expect(manifest.recipes['typeorm-postgres']).toBeUndefined();
    expect(manifest.recipes['drizzle-postgres']).toBeDefined();
    expect(manifest.recipes['drizzle-postgres'].version).toBe('0.0.1');

    // 2. package.json: old deps removed, new deps added
    const pkg = typedReadJson<{
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    }>(tree, 'package.json');
    expect(pkg.dependencies['@nestjs/typeorm']).toBeUndefined();
    expect(pkg.dependencies['typeorm']).toBeUndefined();
    expect(pkg.dependencies['drizzle-orm']).toBe('0.44.2');
    expect(pkg.dependencies['pg']).toBe('8.13.1'); // shared dep stays
    expect(pkg.devDependencies['drizzle-kit']).toBe('0.31.1');

    // 3. .env.example: old env section removed, new section added
    const envContent = tree.read('.env.example', 'utf-8')!;
    expect(envContent).not.toContain('DB_HOST');
    expect(envContent).not.toContain('# --- TypeORM + PostgreSQL ---');
    expect(envContent).toContain('DATABASE_URL');
    expect(envContent).toContain('PORT=3000'); // existing vars preserved

    // 4. CLAUDE.md: old section removed, new section added
    const claudeContent = tree.read('CLAUDE.md', 'utf-8')!;
    expect(claudeContent).not.toContain('@spoonfeeder:typeorm-postgres');
    expect(claudeContent).toContain('@spoonfeeder:drizzle-postgres');
    expect(claudeContent).toContain('Drizzle ORM');
    expect(claudeContent).toContain('## Package Manager'); // existing content preserved

    // 5. Old recipe files removed
    expect(tree.exists('src/infrastructure/database/database.module.ts')).toBe(false);
    expect(tree.exists('src/infrastructure/database/typeorm.config.ts')).toBe(false);

    // 6. app.module.ts: old import removed
    const appModule = tree.read('src/app.module.ts', 'utf-8')!;
    expect(appModule).not.toContain('DatabaseModule');
    expect(appModule).not.toContain('@/infrastructure/database/database.module');
  });

  it('should reject migration from uninstalled recipe', async () => {
    await expect(
      migrateRecipeGenerator(tree, { from: 'prisma', to: 'drizzle-postgres' }),
    ).rejects.toThrow("Recipe 'prisma' is not installed");
  });

  it('should reject cross-category migration', async () => {
    await expect(
      migrateRecipeGenerator(tree, { from: 'typeorm-postgres', to: 'swagger' }),
    ).rejects.toThrow('Cannot migrate between different categories');
  });

  it('should work with dry-run flag without error', async () => {
    // Note: dry-run in Nx devkit still applies changes to the virtual tree.
    // The actual dry-run behavior (no disk write) is handled by the Nx runner,
    // not by the generator itself. This test verifies the flag is accepted.
    await migrateRecipeGenerator(tree, {
      from: 'typeorm-postgres',
      to: 'drizzle-postgres',
      dryRun: true,
    });

    // The generator runs against the virtual tree regardless of dryRun flag.
    // The Nx CLI intercepts dryRun and prevents disk writes.
    // We just verify it completes without error.
    expect(true).toBe(true);
  });
});
