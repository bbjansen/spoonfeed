import { mergeEnvVars, renderEnvFile } from '@spoonfeeder/generator/env-merger';
import type { EnvVar } from '@spoonfeeder/types';

describe('mergeEnvVars', () => {
  it('should merge env vars from multiple sources', () => {
    const base: EnvVar[] = [{ key: 'PORT', defaultValue: '3000', description: 'HTTP port' }];

    const additions: EnvVar[][] = [
      [
        {
          key: 'DATABASE_URL',
          defaultValue: 'postgres://localhost:5432/app',
          description: 'Database connection string',
        },
      ],
      [
        {
          key: 'REDIS_URL',
          defaultValue: 'redis://localhost:6379',
          description: 'Redis connection URL',
        },
      ],
    ];

    const result = mergeEnvVars(base, additions);
    expect(result).toHaveLength(3);
    expect(result.map((v) => v.key)).toEqual(['PORT', 'DATABASE_URL', 'REDIS_URL']);
  });

  it('should deduplicate by key, keeping last value', () => {
    const base: EnvVar[] = [{ key: 'PORT', defaultValue: '3000', description: 'HTTP port' }];

    const additions: EnvVar[][] = [
      [{ key: 'PORT', defaultValue: '8080', description: 'Updated port' }],
    ];

    const result = mergeEnvVars(base, additions);
    expect(result).toHaveLength(1);
    expect(result[0].defaultValue).toBe('8080');
  });
});

describe('renderEnvFile', () => {
  it('should render as .env format', () => {
    const vars: EnvVar[] = [
      { key: 'PORT', defaultValue: '3000', description: 'HTTP port' },
      {
        key: 'DB_URL',
        defaultValue: 'postgres://localhost/app',
        description: 'Database URL',
      },
    ];

    const rendered = renderEnvFile(vars);
    expect(rendered).toContain('# HTTP port');
    expect(rendered).toContain('PORT=3000');
    expect(rendered).toContain('# Database URL');
    expect(rendered).toContain('DB_URL=postgres://localhost/app');
  });
});
