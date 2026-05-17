describe('MikroORM config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use default values when environment variables are not set', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../../../src/infrastructure/database/mikro-orm.config').default;

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
    expect(config.dbName).toBe('app');
    expect(config.user).toBe('postgres');
    expect(config.password).toBe('postgres');
  });

  it('should pick up custom environment variables', () => {
    process.env.DB_HOST = '10.0.0.1';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'mydb';
    process.env.DB_USERNAME = 'admin';
    process.env.DB_PASSWORD = 's3cret';

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../../../src/infrastructure/database/mikro-orm.config').default;

    expect(config.host).toBe('10.0.0.1');
    expect(config.port).toBe(5433);
    expect(config.dbName).toBe('mydb');
    expect(config.user).toBe('admin');
    expect(config.password).toBe('s3cret');
  });

  it('should include the Migrator extension', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../../../src/infrastructure/database/mikro-orm.config').default;
    expect(config.extensions).toBeDefined();
    expect(config.extensions.length).toBeGreaterThanOrEqual(1);
  });
});
