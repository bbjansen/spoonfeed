import { validateConfig } from '@spoonfeeder/validation/config-validator';
import type { ProjectConfig } from '@spoonfeeder/types';

const validConfig: ProjectConfig = {
  name: 'my-api',
  scope: '@myorg',
  projectType: 'http-api',
  cloudProvider: 'aws',
  recipes: ['swagger', 'pino'],
  transportLayer: undefined,
  frontendFramework: undefined,
  deploymentTargets: ['dockerfile'],
  ciCdProvider: 'github-actions',
  outputDir: './my-api',
};

describe('validateConfig', () => {
  it('should accept a valid config', () => {
    const result = validateConfig(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject empty project name', () => {
    const result = validateConfig({ ...validConfig, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
    }
  });

  it('should reject invalid project name characters', () => {
    const result = validateConfig({ ...validConfig, name: 'My App!' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid project type', () => {
    const invalidConfig = { ...validConfig, projectType: 'invalid' };
    // @ts-expect-error testing invalid input
    const result = validateConfig(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should require transportLayer for microservice type', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: 'microservice',
      transportLayer: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'transportLayer' }));
    }
  });

  it('should require frontendFramework for full-stack type', () => {
    const result = validateConfig({
      ...validConfig,
      projectType: 'full-stack',
      frontendFramework: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'frontendFramework' }));
    }
  });
});
