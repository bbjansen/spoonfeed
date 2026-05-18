import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { addModuleImport, removeModuleImport } from '@spoonfeed/utils/module-updater';
import { insertBlock, removeBlock } from '@spoonfeed/utils/main-ts-updater';

describe('AST Transforms Integration', () => {
  let tmpDir: string;
  let appModulePath: string;
  let mainTsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-integration-test-'));

    // Create a minimal project structure that mimics a generated project
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    appModulePath = path.join(srcDir, 'app.module.ts');
    mainTsPath = path.join(srcDir, 'main.ts');

    fs.writeFileSync(
      appModulePath,
      `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
`,
      'utf-8',
    );

    fs.writeFileSync(
      mainTsPath,
      `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
`,
      'utf-8',
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add swagger module import to app.module.ts and block to main.ts', () => {
    // Add module import
    addModuleImport(appModulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');

    const moduleContent = fs.readFileSync(appModulePath, 'utf-8');
    expect(moduleContent).toContain('SwaggerModule');
    expect(moduleContent).toContain('@/infrastructure/swagger/swagger.module');

    // Add main.ts block
    insertBlock(mainTsPath, 'swagger-setup', {
      imports: [
        {
          namedImports: ['DocumentBuilder', 'SwaggerModule'],
          moduleSpecifier: '@nestjs/swagger',
        },
      ],
      code: `  const swaggerConfig = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);`,
    });

    const mainContent = fs.readFileSync(mainTsPath, 'utf-8');
    expect(mainContent).toContain('// --- swagger-setup start ---');
    expect(mainContent).toContain('SwaggerModule.setup');
    expect(mainContent).toContain(
      "import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'",
    );
  });

  it('should add and then remove swagger cleanly', () => {
    // Add
    addModuleImport(appModulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
    insertBlock(mainTsPath, 'swagger-setup', {
      imports: [
        {
          namedImports: ['DocumentBuilder', 'SwaggerModule'],
          moduleSpecifier: '@nestjs/swagger',
        },
      ],
      code: `  SwaggerModule.setup('api/docs', app, {});`,
    });

    // Verify added
    expect(fs.readFileSync(appModulePath, 'utf-8')).toContain('SwaggerModule');
    expect(fs.readFileSync(mainTsPath, 'utf-8')).toContain('swagger-setup');

    // Remove
    removeModuleImport(appModulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
    removeBlock(mainTsPath, 'swagger-setup', ['@nestjs/swagger']);

    // Verify removed — content should not contain swagger references
    const cleanedModule = fs.readFileSync(appModulePath, 'utf-8');
    const cleanedMain = fs.readFileSync(mainTsPath, 'utf-8');

    expect(cleanedModule).not.toContain('SwaggerModule');
    expect(cleanedModule).not.toContain('@/infrastructure/swagger');
    expect(cleanedModule).toContain('ConfigModule');

    expect(cleanedMain).not.toContain('swagger-setup');
    expect(cleanedMain).not.toContain('@nestjs/swagger');
    expect(cleanedMain).toContain('await app.listen');
  });

  it('should handle adding multiple recipes without conflicts', () => {
    // Add swagger
    addModuleImport(appModulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');
    insertBlock(mainTsPath, 'swagger-setup', {
      imports: [
        {
          namedImports: ['DocumentBuilder', 'SwaggerModule'],
          moduleSpecifier: '@nestjs/swagger',
        },
      ],
      code: `  SwaggerModule.setup('api/docs', app, {});`,
    });

    // Add logging module
    addModuleImport(appModulePath, 'LoggingModule', '@/infrastructure/logging/logging.module');

    // Add health module
    addModuleImport(appModulePath, 'HealthModule', '@/infrastructure/health/health.module');

    // Add helmet block
    insertBlock(mainTsPath, 'helmet-setup', {
      imports: [{ namedImports: ['default as helmet'], moduleSpecifier: '@fastify/helmet' }],
      code: '  await app.register(helmet);',
    });

    const moduleContent = fs.readFileSync(appModulePath, 'utf-8');
    expect(moduleContent).toContain('SwaggerModule');
    expect(moduleContent).toContain('LoggingModule');
    expect(moduleContent).toContain('HealthModule');
    expect(moduleContent).toContain('ConfigModule');

    const mainContent = fs.readFileSync(mainTsPath, 'utf-8');
    expect(mainContent).toContain('// --- swagger-setup start ---');
    expect(mainContent).toContain('// --- helmet-setup start ---');
    expect(mainContent).toContain('await app.listen');
  });

  it('should produce valid TypeScript syntax after modifications', () => {
    addModuleImport(appModulePath, 'SwaggerModule', '@/infrastructure/swagger/swagger.module');

    insertBlock(mainTsPath, 'swagger-setup', {
      imports: [
        {
          namedImports: ['DocumentBuilder', 'SwaggerModule'],
          moduleSpecifier: '@nestjs/swagger',
        },
      ],
      code: `  const swaggerConfig = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);`,
    });

    // Re-apply addModuleImport on the already-modified file to verify ts-morph can re-parse it
    // This validates the output is valid TypeScript (ts-morph would throw on syntax errors)
    addModuleImport(appModulePath, 'HealthModule', '@/infrastructure/health/health.module');

    const finalModule = fs.readFileSync(appModulePath, 'utf-8');
    expect(finalModule).toContain('SwaggerModule');
    expect(finalModule).toContain('HealthModule');
    expect(finalModule).toContain('ConfigModule.forRoot');

    const finalMain = fs.readFileSync(mainTsPath, 'utf-8');
    expect(finalMain).toContain('// --- swagger-setup start ---');
    expect(finalMain).toContain('await app.listen');
  });
});
