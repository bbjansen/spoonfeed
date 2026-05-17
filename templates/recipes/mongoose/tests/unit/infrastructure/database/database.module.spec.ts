import { ConfigService } from '@nestjs/config';

describe('Mongoose DatabaseModule config', () => {
  it('should use MONGO_URI from config with a default fallback', () => {
    const configService = new ConfigService({});
    const uri = configService.get<string>('MONGO_URI', 'mongodb://localhost:27017');
    expect(uri).toBe('mongodb://localhost:27017');
  });

  it('should use the configured MONGO_URI when present', () => {
    const configService = new ConfigService({
      MONGO_URI: 'mongodb://mongo.prod:27017',
    });
    const uri = configService.get<string>('MONGO_URI', 'mongodb://localhost:27017');
    expect(uri).toBe('mongodb://mongo.prod:27017');
  });

  it('should use MONGO_DB_NAME from config', () => {
    const configService = new ConfigService({
      MONGO_DB_NAME: 'my-app',
    });
    const dbName = configService.get<string>('MONGO_DB_NAME', 'default-db');
    expect(dbName).toBe('my-app');
  });
});
