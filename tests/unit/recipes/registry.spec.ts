import { RecipeRegistry } from '@spoonfeeder/recipes/registry';
import type { RecipeDefinition } from '@spoonfeeder/types';

const mockRecipe: RecipeDefinition = {
  id: 'swagger',
  name: 'Swagger / OpenAPI',
  description: 'API documentation with Swagger UI',
  category: 'api-docs',
  dependencies: { '@nestjs/swagger': '11.2.0' },
  devDependencies: {},
  envVars: [],
  conflicts: [],
  requires: [],
  compatibleWith: ['http-api', 'full-stack', 'monorepo'],
  templateDir: 'recipes/api-docs/swagger',
  claudeMdSection: '## Swagger\nDocs at /api/docs',
  cursorRules: 'Use @ApiProperty on all DTOs',
  copilotInstructions: 'Use @ApiProperty on all DTOs',
};

const mockRecipe2: RecipeDefinition = {
  id: 'pino',
  name: 'Pino',
  description: 'Fast JSON logger',
  category: 'logging',
  dependencies: { 'nestjs-pino': '4.2.0', pino: '9.6.0' },
  devDependencies: { 'pino-pretty': '13.0.0' },
  envVars: [{ key: 'LOG_LEVEL', defaultValue: 'info', description: 'Log level' }],
  conflicts: ['winston'],
  requires: [],
  compatibleWith: 'all',
  templateDir: 'recipes/logging/pino',
  claudeMdSection: '## Logging\nUses Pino',
  cursorRules: 'Use Logger from nestjs-pino',
  copilotInstructions: 'Use Logger from nestjs-pino',
};

describe('RecipeRegistry', () => {
  let registry: RecipeRegistry;

  beforeEach(() => {
    registry = new RecipeRegistry();
    registry.register(mockRecipe);
    registry.register(mockRecipe2);
  });

  it('should get recipe by id', () => {
    const recipe = registry.get('swagger');
    expect(recipe).toBeDefined();
    expect(recipe!.name).toBe('Swagger / OpenAPI');
  });

  it('should return undefined for unknown id', () => {
    expect(registry.get('unknown' as any)).toBeUndefined();
  });

  it('should filter by project type compatibility', () => {
    const compatible = registry.getCompatibleWith('http-api');
    expect(compatible).toHaveLength(2);
  });

  it('should exclude incompatible recipes', () => {
    const compatible = registry.getCompatibleWith('cli-app');
    expect(compatible).toHaveLength(1);
    expect(compatible[0].id).toBe('pino');
  });

  it('should get all recipes by category', () => {
    const logging = registry.getByCategory('logging');
    expect(logging).toHaveLength(1);
    expect(logging[0].id).toBe('pino');
  });
});
