import { CacheModule } from '../../../../src/infrastructure/cache/cache.module';

describe('CacheModule', () => {
  it('should be defined', () => {
    expect(CacheModule).toBeDefined();
  });

  it('should be a class that can be referenced as a module', () => {
    expect(typeof CacheModule).toBe('function');
    expect(CacheModule.name).toBe('CacheModule');
  });
});
