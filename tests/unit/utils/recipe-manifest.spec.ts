import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  readManifest,
  writeManifest,
  addRecipeToManifest,
  isRecipeInstalled,
  type SpoonfeederManifest,
} from '@spoonfeeder/utils/recipe-manifest';

describe('recipe-manifest', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return null when manifest does not exist', () => {
    expect(readManifest(tmpDir)).toBeNull();
  });

  it('should write and read a manifest', () => {
    const manifest: SpoonfeederManifest = {
      projectType: 'http-api',
      cloudProvider: 'aws',
      spoonfeederVersion: '0.0.1',
      generatedAt: '2026-05-12T10:00:00Z',
      recipes: {},
    };

    writeManifest(tmpDir, manifest);
    const result = readManifest(tmpDir);
    expect(result).toEqual(manifest);
  });

  it('should add a recipe to the manifest', () => {
    const manifest: SpoonfeederManifest = {
      projectType: 'http-api',
      cloudProvider: 'aws',
      spoonfeederVersion: '0.0.1',
      generatedAt: '2026-05-12T10:00:00Z',
      recipes: {},
    };

    writeManifest(tmpDir, manifest);

    addRecipeToManifest(tmpDir, 'swagger', {
      files: ['src/main.swagger.ts'],
      moduleImport: { moduleName: 'SwaggerModule', importPath: '@/swagger' },
    });

    const updated = readManifest(tmpDir);
    expect(updated?.recipes['swagger']).toBeDefined();
    expect(updated?.recipes['swagger'].files).toEqual(['src/main.swagger.ts']);
  });

  it('should check if a recipe is installed', () => {
    const manifest: SpoonfeederManifest = {
      projectType: 'http-api',
      cloudProvider: 'aws',
      spoonfeederVersion: '0.0.1',
      generatedAt: '2026-05-12T10:00:00Z',
      recipes: {
        swagger: {
          installedAt: '2026-05-12T10:05:00Z',
          version: '0.0.1',
          files: [],
        },
      },
    };

    writeManifest(tmpDir, manifest);
    expect(isRecipeInstalled(tmpDir, 'swagger')).toBe(true);
    expect(isRecipeInstalled(tmpDir, 'pino')).toBe(false);
  });
});
