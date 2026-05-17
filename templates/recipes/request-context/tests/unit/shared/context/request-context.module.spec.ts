import { RequestContextModule } from '../../../../src/shared/context/request-context.module';

describe('RequestContextModule', () => {
  it('should be a valid NestJS module with imports and exports', () => {
    const imports = Reflect.getMetadata('imports', RequestContextModule);
    const exports = Reflect.getMetadata('exports', RequestContextModule);

    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);
    expect(exports).toBeDefined();
    expect(exports.length).toBeGreaterThan(0);
  });

  it('should export ClsModule so dependents can inject CLS', () => {
    const exports = Reflect.getMetadata('exports', RequestContextModule);

    const exportNames = exports.map((e: any) => e?.name ?? String(e));
    expect(exportNames).toContain('ClsModule');
  });
});
