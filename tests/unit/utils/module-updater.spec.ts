import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { addModuleImport, removeModuleImport } from '@spoonfeeder/utils/module-updater';

describe('module-updater', () => {
  let tmpDir: string;
  let modulePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-updater-test-'));
    modulePath = path.join(tmpDir, 'app.module.ts');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeModule(content: string): void {
    fs.writeFileSync(modulePath, content, 'utf-8');
  }

  function readModule(): string {
    return fs.readFileSync(modulePath, 'utf-8');
  }

  const BASE_MODULE = `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
`;

  describe('addModuleImport', () => {
    it('should add an import declaration and register module in imports array', () => {
      writeModule(BASE_MODULE);

      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');

      const result = readModule();
      expect(result).toContain(
        `import { SwaggerModule } from "@/infrastructure/swagger/swagger.module"`,
      );
      expect(result).toContain('SwaggerModule');
      // Verify it appears in the @Module imports array (not just the import statement)
      const moduleDecoratorMatch = result.match(/@Module\(\{[\s\S]*?imports:\s*\[([\s\S]*?)\]/);
      expect(moduleDecoratorMatch).not.toBeNull();
      expect(moduleDecoratorMatch![1]).toContain('SwaggerModule');
    });

    it('should skip if import already exists (idempotent)', () => {
      writeModule(BASE_MODULE);

      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
      const firstResult = readModule();

      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
      const secondResult = readModule();

      expect(firstResult).toBe(secondResult);
    });

    it('should handle a module with no existing imports property', () => {
      writeModule(`import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
`);

      addModuleImport(modulePath, 'LoggingModule', '@/infrastructure/logging/logging.module');

      const result = readModule();
      expect(result).toContain(
        `import { LoggingModule } from "@/infrastructure/logging/logging.module"`,
      );
      const moduleDecoratorMatch = result.match(/@Module\(\{[\s\S]*?imports:\s*\[([\s\S]*?)\]/);
      expect(moduleDecoratorMatch).not.toBeNull();
      expect(moduleDecoratorMatch![1]).toContain('LoggingModule');
    });

    it('should throw if no @Module decorator is found', () => {
      writeModule(`import { Injectable } from '@nestjs/common';

@Injectable()
export class SomeService {}
`);

      expect(() => {
        addModuleImport(modulePath, 'SwaggerModule', '@/swagger');
      }).toThrow('No class with @Module decorator found');
    });

    it('should preserve ConfigModule.forRoot() call expressions in imports', () => {
      writeModule(BASE_MODULE);

      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');

      const result = readModule();
      expect(result).toContain('ConfigModule.forRoot');
      expect(result).toContain('isGlobal: true');
    });
  });

  describe('removeModuleImport', () => {
    it('should remove the import declaration and module from imports array', () => {
      writeModule(BASE_MODULE);

      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
      removeModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');

      const result = readModule();
      expect(result).not.toContain('SwaggerModule');
      expect(result).not.toContain('@/infrastructure/swagger/swagger.module');
      // ConfigModule should still be there
      expect(result).toContain('ConfigModule');
    });

    it('should be a no-op if the module is not present', () => {
      writeModule(BASE_MODULE);
      const before = readModule();

      removeModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');

      const after = readModule();
      expect(before).toBe(after);
    });

    it('should preserve other imports when removing one', () => {
      writeModule(BASE_MODULE);

      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
      addModuleImport(modulePath, 'LoggingModule', '@/infrastructure/logging/logging.module');
      removeModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');

      const result = readModule();
      expect(result).not.toContain('SwaggerModule');
      expect(result).toContain('LoggingModule');
      expect(result).toContain('ConfigModule');
    });
  });

  describe('snapshots', () => {
    it('should match snapshot after adding 1 recipe', () => {
      writeModule(BASE_MODULE);
      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
      expect(readModule()).toMatchSnapshot();
    });

    it('should match snapshot after adding 2 recipes', () => {
      writeModule(BASE_MODULE);
      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
      addModuleImport(modulePath, 'LoggingModule', '@/infrastructure/logging/logging.module');
      expect(readModule()).toMatchSnapshot();
    });

    it('should match snapshot after adding 3 recipes', () => {
      writeModule(BASE_MODULE);
      addModuleImport(modulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
      addModuleImport(modulePath, 'LoggingModule', '@/infrastructure/logging/logging.module');
      addModuleImport(modulePath, 'HealthModule', '@/infrastructure/health/health.module');
      expect(readModule()).toMatchSnapshot();
    });
  });
});
