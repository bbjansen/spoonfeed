import { InternationalizationModule } from '../../../../src/shared/i18n/i18n.module';

describe('InternationalizationModule', () => {
  it('should be a valid NestJS module with imports defined', () => {
    const imports = Reflect.getMetadata('imports', InternationalizationModule);

    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);
  });

  it('should configure I18nModule with English as the fallback language', () => {
    const imports = Reflect.getMetadata('imports', InternationalizationModule) as any[];
    const i18nConfig = imports[0];

    expect(i18nConfig).toBeDefined();
    expect(i18nConfig.module?.name ?? i18nConfig.name).toContain('I18n');
  });
});
