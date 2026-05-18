import {
  mergePackageJson,
  type PackageJsonFragment,
} from '@spoonfeed/generator/package-json-merger';

describe('mergePackageJson', () => {
  it('should merge dependencies from multiple fragments', () => {
    const base = {
      name: 'my-app',
      dependencies: { '@nestjs/core': '11.1.18' },
      devDependencies: { jest: '30.3.0' },
    };

    const fragments: PackageJsonFragment[] = [
      {
        dependencies: { '@nestjs/swagger': '11.2.0' },
        devDependencies: {},
      },
      {
        dependencies: { ioredis: '5.6.1' },
        devDependencies: { '@types/ioredis': '5.0.0' },
      },
    ];

    const result = mergePackageJson(base, fragments);

    expect(result.name).toBe('my-app');
    expect(result.dependencies).toEqual({
      '@nestjs/core': '11.1.18',
      '@nestjs/swagger': '11.2.0',
      ioredis: '5.6.1',
    });
    expect(result.devDependencies).toEqual({
      '@types/ioredis': '5.0.0',
      jest: '30.3.0',
    });
  });

  it('should merge scripts', () => {
    const base = {
      name: 'my-app',
      scripts: { start: 'nest start' },
      dependencies: {},
      devDependencies: {},
    };

    const fragments = [
      {
        scripts: { 'db:migrate': 'typeorm migration:run' },
        dependencies: {},
        devDependencies: {},
      },
    ];

    const result = mergePackageJson(base, fragments);
    expect(result.scripts).toEqual({
      start: 'nest start',
      'db:migrate': 'typeorm migration:run',
    });
  });

  it('should sort dependencies alphabetically', () => {
    const base = {
      name: 'my-app',
      dependencies: { zod: '3.0.0', axios: '1.0.0' },
      devDependencies: {},
    };

    const result = mergePackageJson(base, []);
    const keys = Object.keys(result.dependencies as Record<string, string>);
    expect(keys).toEqual(['axios', 'zod']);
  });

  it('should handle empty fragments array', () => {
    const base = {
      name: 'my-app',
      dependencies: { a: '1.0.0' },
      devDependencies: {},
    };

    const result = mergePackageJson(base, []);
    expect(result.dependencies).toEqual({ a: '1.0.0' });
  });
});
