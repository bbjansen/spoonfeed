import { AdminModule } from '@/app/modules/admin/admin.module';

describe('AdminModule', () => {
  it('should be defined as a class', () => {
    expect(AdminModule).toBeDefined();
    expect(typeof AdminModule).toBe('function');
  });

  it('should be instantiable', () => {
    const instance = new AdminModule();
    expect(instance).toBeInstanceOf(AdminModule);
  });

  it('should have Module decorator metadata with imports', () => {
    // Reflect.getMetadata is populated by @Module decorator at class-definition time.
    // 'imports' is stored under the key 'imports' by NestJS.
    const imports = Reflect.getMetadata('imports', AdminModule);
    expect(imports).toBeDefined();
    expect(Array.isArray(imports)).toBe(true);
    expect(imports.length).toBeGreaterThan(0);
  });
});
