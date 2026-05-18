import { detectConflicts } from '@spoonfeed/validation/conflict-detector';
import type { RecipeDefinition } from '@spoonfeed/types';

function makeRecipe(overrides: Partial<RecipeDefinition> & { id: string }): RecipeDefinition {
  return {
    name: overrides.id,
    description: '',
    category: '',
    dependencies: {},
    devDependencies: {},
    envVars: [],
    conflicts: [],
    requires: [],
    compatibleWith: 'all',
    templateDir: '',
    claudeMdSection: '',
    cursorRules: '',
    copilotInstructions: '',
    ...overrides,
  } as RecipeDefinition;
}

const recipes: RecipeDefinition[] = [
  makeRecipe({
    id: 'typeorm-postgres',
    name: 'TypeORM + Postgres',
    conflicts: ['typeorm-mysql', 'prisma', 'mongoose'],
  }),
  makeRecipe({
    id: 'typeorm-mysql',
    name: 'TypeORM + MySQL',
    conflicts: ['typeorm-postgres', 'prisma', 'mongoose'],
  }),
  makeRecipe({
    id: 'prisma',
    name: 'Prisma',
    conflicts: ['typeorm-postgres', 'typeorm-mysql', 'mongoose'],
  }),
  makeRecipe({
    id: 'mongoose',
    name: 'Mongoose',
    conflicts: ['typeorm-postgres', 'typeorm-mysql', 'prisma'],
  }),
  makeRecipe({ id: 'pino', name: 'Pino', conflicts: ['winston'] }),
  makeRecipe({ id: 'winston', name: 'Winston', conflicts: ['pino'] }),
  makeRecipe({ id: 'nodemailer', name: 'Nodemailer', conflicts: ['sendgrid'] }),
  makeRecipe({ id: 'sendgrid', name: 'SendGrid', conflicts: ['nodemailer'] }),
  makeRecipe({ id: 'swagger', name: 'Swagger' }),
  makeRecipe({ id: 'redis-cache', name: 'Redis Cache' }),
  makeRecipe({ id: 'database-seeding', name: 'Database Seeding', requires: ['typeorm-postgres'] }),
];

describe('detectConflicts', () => {
  it('should return no conflicts for compatible recipes', () => {
    const result = detectConflicts(['swagger', 'pino', 'redis-cache'], recipes);
    expect(result).toHaveLength(0);
  });

  it('should detect ORM conflicts from per-recipe metadata', () => {
    const result = detectConflicts(['typeorm-postgres', 'prisma'], recipes);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('mutual-exclusion');
    expect(result[0].recipes).toContain('typeorm-postgres');
    expect(result[0].recipes).toContain('prisma');
  });

  it('should detect logger conflicts', () => {
    const result = detectConflicts(['pino', 'winston'], recipes);
    expect(result).toHaveLength(1);
  });

  it('should detect email conflicts', () => {
    const result = detectConflicts(['nodemailer', 'sendgrid'], recipes);
    expect(result).toHaveLength(1);
  });

  it('should detect multiple conflicts at once', () => {
    const result = detectConflicts(['typeorm-postgres', 'prisma', 'pino', 'winston'], recipes);
    expect(result).toHaveLength(2);
  });

  it('should detect missing requirements', () => {
    const result = detectConflicts(['database-seeding'], recipes);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('missing-requirement');
    expect(result[0].recipes).toContain('typeorm-postgres');
  });

  it('should not flag requirements that are selected', () => {
    const result = detectConflicts(['database-seeding', 'typeorm-postgres'], recipes);
    const reqConflicts = result.filter((c) => c.type === 'missing-requirement');
    expect(reqConflicts).toHaveLength(0);
  });

  it('should handle empty recipe list', () => {
    const result = detectConflicts([], recipes);
    expect(result).toHaveLength(0);
  });

  it('should work without recipe definitions (backward compat)', () => {
    const result = detectConflicts(['swagger', 'pino']);
    expect(result).toHaveLength(0);
  });
});
