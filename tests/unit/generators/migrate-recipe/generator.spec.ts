import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson } from '@nx/devkit';
import migrateRecipeGenerator, {
  validateMigrationPair,
} from '@spoonfeed/generators/migrate-recipe/generator';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import { getMigrationGuidance } from '@spoonfeed/generators/migrate-recipe/migration-guidance';

function typedReadJson<T>(tree: Tree, path: string): T {
  return readJson(tree, path) as T;
}

describe('migrate-recipe generator', () => {
  let tree: Tree;
  let registry: RecipeRegistry;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    registry = new RecipeRegistry();
    registerAllRecipes(registry);

    // Seed a minimal project with typeorm-postgres installed
    tree.write(
      '.spoonfeed.json',
      JSON.stringify({
        projectType: 'http-api',
        cloudProvider: 'aws',
        spoonfeedVersion: '0.0.1',
        generatedAt: '2026-05-12T10:00:00Z',
        recipes: {
          'typeorm-postgres': {
            installedAt: '2026-05-12T10:05:00Z',
            version: '0.0.1',
            files: ['src/infrastructure/database/database.module.ts'],
            mainTsBlocks: [],
            envSection: 'TypeORM + PostgreSQL',
            moduleImport: {
              moduleName: 'DatabaseModule',
              importPath: '@/infrastructure/database/database.module',
            },
          },
        },
      }),
    );

    tree.write(
      'package.json',
      JSON.stringify({
        name: 'test-project',
        dependencies: {
          '@nestjs/typeorm': '10.0.2',
          typeorm: '0.3.20',
          pg: '8.13.1',
        },
        devDependencies: {},
      }),
    );

    tree.write(
      '.env.example',
      '# Application\nPORT=3000\n\n# --- TypeORM + PostgreSQL ---\n# PostgreSQL host\nDB_HOST=localhost\n# --- end TypeORM + PostgreSQL ---\n',
    );
    tree.write(
      'CLAUDE.md',
      '# CLAUDE.md\n\n<!-- @spoonfeed:typeorm-postgres -->\n## TypeORM + PostgreSQL\n<!-- @spoonfeed:end:typeorm-postgres -->\n',
    );
    tree.write(
      'src/app.module.ts',
      `import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
})
export class AppModule {}
`,
    );
    tree.write('src/infrastructure/database/database.module.ts', 'export class DatabaseModule {}');
  });

  describe('validateMigrationPair', () => {
    it('should pass for valid same-category migration', () => {
      const result = validateMigrationPair(registry, 'typeorm-postgres', 'drizzle-postgres', [
        'typeorm-postgres',
      ]);
      expect(result.fromRecipe.id).toBe('typeorm-postgres');
      expect(result.toRecipe.id).toBe('drizzle-postgres');
    });

    it('should reject unknown from recipe', () => {
      expect(() =>
        validateMigrationPair(registry, 'nonexistent', 'drizzle-postgres', ['nonexistent']),
      ).toThrow("Recipe 'nonexistent' not found in the registry.");
    });

    it('should reject unknown to recipe', () => {
      expect(() =>
        validateMigrationPair(registry, 'typeorm-postgres', 'nonexistent', ['typeorm-postgres']),
      ).toThrow("Recipe 'nonexistent' not found in the registry.");
    });

    it('should reject when from recipe is not installed', () => {
      expect(() =>
        validateMigrationPair(registry, 'typeorm-postgres', 'drizzle-postgres', []),
      ).toThrow("Recipe 'typeorm-postgres' is not installed.");
    });

    it('should reject when to recipe is already installed', () => {
      expect(() =>
        validateMigrationPair(registry, 'typeorm-postgres', 'drizzle-postgres', [
          'typeorm-postgres',
          'drizzle-postgres',
        ]),
      ).toThrow("Recipe 'drizzle-postgres' is already installed.");
    });

    it('should reject cross-category migration', () => {
      expect(() =>
        validateMigrationPair(registry, 'typeorm-postgres', 'pino', ['typeorm-postgres']),
      ).toThrow('Cannot migrate between different categories');
    });

    it('should reject migrating a recipe to itself', () => {
      expect(() =>
        validateMigrationPair(registry, 'typeorm-postgres', 'typeorm-postgres', [
          'typeorm-postgres',
        ]),
      ).toThrow('Cannot migrate a recipe to itself.');
    });
  });

  describe('getMigrationGuidance', () => {
    it('should return pair-specific guidance when available', () => {
      const guidance = getMigrationGuidance('typeorm-postgres', 'drizzle-postgres', 'Database');
      expect(guidance.some((line) => line.includes('Drizzle'))).toBe(true);
      expect(guidance.some((line) => line.includes('pgTable'))).toBe(true);
    });

    it('should return category fallback when no pair guidance exists', () => {
      const guidance = getMigrationGuidance('typeorm-postgres', 'kysely', 'Database');
      expect(guidance.some((line) => line.includes('database recipes'))).toBe(true);
    });

    it('should return generic guidance for unknown category', () => {
      const guidance = getMigrationGuidance('a', 'b', 'UnknownCategory');
      expect(guidance.some((line) => line.includes('Migration complete'))).toBe(true);
    });
  });

  describe('migrateRecipeGenerator', () => {
    it('should throw when .spoonfeed.json is missing', async () => {
      tree.delete('.spoonfeed.json');
      await expect(
        migrateRecipeGenerator(tree, { from: 'typeorm-postgres', to: 'drizzle-postgres' }),
      ).rejects.toThrow('.spoonfeed.json not found');
    });

    it('should throw for cross-category migration', async () => {
      await expect(
        migrateRecipeGenerator(tree, { from: 'typeorm-postgres', to: 'pino' }),
      ).rejects.toThrow('Cannot migrate between different categories');
    });

    it('should orchestrate remove + add for a valid migration', async () => {
      await migrateRecipeGenerator(tree, {
        from: 'typeorm-postgres',
        to: 'drizzle-postgres',
      });

      const manifest = typedReadJson<{ recipes: Record<string, unknown> }>(
        tree,
        '.spoonfeed.json',
      );
      expect(manifest.recipes['typeorm-postgres']).toBeUndefined();
      expect(manifest.recipes['drizzle-postgres']).toBeDefined();

      const pkg = typedReadJson<{
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      }>(tree, 'package.json');
      expect(pkg.dependencies['typeorm']).toBeUndefined();
      expect(pkg.dependencies['@nestjs/typeorm']).toBeUndefined();
      expect(pkg.dependencies['drizzle-orm']).toBe('0.44.2');
      expect(pkg.devDependencies['drizzle-kit']).toBe('0.31.1');
    });

    it('should update .env.example (remove old section, add new)', async () => {
      await migrateRecipeGenerator(tree, {
        from: 'typeorm-postgres',
        to: 'drizzle-postgres',
      });

      const envContent = tree.read('.env.example', 'utf-8')!;
      expect(envContent).not.toContain('# --- TypeORM + PostgreSQL ---');
      expect(envContent).toContain('DATABASE_URL');
    });

    it('should update CLAUDE.md (remove old section, add new)', async () => {
      await migrateRecipeGenerator(tree, {
        from: 'typeorm-postgres',
        to: 'drizzle-postgres',
      });

      const claudeContent = tree.read('CLAUDE.md', 'utf-8')!;
      expect(claudeContent).not.toContain('@spoonfeed:typeorm-postgres');
      expect(claudeContent).toContain('@spoonfeed:drizzle-postgres');
      expect(claudeContent).toContain('Drizzle ORM');
    });
  });
});
