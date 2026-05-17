import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { insertBlock, removeBlock } from '@spoonfeeder/utils/main-ts-updater';

describe('main-ts-updater', () => {
  let tmpDir: string;
  let mainTsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'main-ts-updater-test-'));
    mainTsPath = path.join(tmpDir, 'main.ts');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeMain(content: string): void {
    fs.writeFileSync(mainTsPath, content, 'utf-8');
  }

  function readMain(): string {
    return fs.readFileSync(mainTsPath, 'utf-8');
  }

  const BASE_MAIN = `import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
`;

  describe('insertBlock', () => {
    it('should insert a delimited block before await app.listen', () => {
      writeMain(BASE_MAIN);

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

      const result = readMain();
      expect(result).toContain('// --- swagger-setup start ---');
      expect(result).toContain('// --- swagger-setup end ---');
      expect(result).toContain('SwaggerModule.setup');
      expect(result).toContain(`import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'`);
      // Block should appear before app.listen
      const blockIdx = result.indexOf('// --- swagger-setup start ---');
      const listenIdx = result.indexOf('await app.listen');
      expect(blockIdx).toBeLessThan(listenIdx);
    });

    it('should be idempotent (skip if block already exists)', () => {
      writeMain(BASE_MAIN);

      const blockDef = {
        imports: [] as { namedImports: string[]; moduleSpecifier: string }[],
        code: '  // hello',
      };

      insertBlock(mainTsPath, 'test-block', blockDef);
      const firstResult = readMain();

      insertBlock(mainTsPath, 'test-block', blockDef);
      const secondResult = readMain();

      expect(firstResult).toBe(secondResult);
    });

    it('should insert multiple blocks in order', () => {
      writeMain(BASE_MAIN);

      insertBlock(mainTsPath, 'swagger-setup', {
        imports: [
          {
            namedImports: ['DocumentBuilder', 'SwaggerModule'],
            moduleSpecifier: '@nestjs/swagger',
          },
        ],
        code: `  const swaggerConfig = new DocumentBuilder().build();
  SwaggerModule.setup('api/docs', app, swaggerConfig);`,
      });

      insertBlock(mainTsPath, 'compression-setup', {
        imports: [
          { namedImports: ['default as compression'], moduleSpecifier: '@fastify/compress' },
        ],
        code: '  await app.register(compression);',
      });

      const result = readMain();
      expect(result).toContain('// --- swagger-setup start ---');
      expect(result).toContain('// --- compression-setup start ---');

      // Both blocks should appear before app.listen
      const swaggerIdx = result.indexOf('// --- swagger-setup start ---');
      const compressionIdx = result.indexOf('// --- compression-setup start ---');
      const listenIdx = result.indexOf('await app.listen');
      expect(swaggerIdx).toBeLessThan(listenIdx);
      expect(compressionIdx).toBeLessThan(listenIdx);
    });

    it('should throw if main.ts file does not exist', () => {
      expect(() => {
        insertBlock(mainTsPath, 'test', { imports: [], code: '// test' });
      }).toThrow();
    });
  });

  describe('removeBlock', () => {
    it('should remove a delimited block and its imports', () => {
      writeMain(BASE_MAIN);

      insertBlock(mainTsPath, 'swagger-setup', {
        imports: [
          {
            namedImports: ['DocumentBuilder', 'SwaggerModule'],
            moduleSpecifier: '@nestjs/swagger',
          },
        ],
        code: `  const swaggerConfig = new DocumentBuilder().build();
  SwaggerModule.setup('api/docs', app, swaggerConfig);`,
      });

      removeBlock(mainTsPath, 'swagger-setup', ['@nestjs/swagger']);

      const result = readMain();
      expect(result).not.toContain('// --- swagger-setup start ---');
      expect(result).not.toContain('// --- swagger-setup end ---');
      expect(result).not.toContain('SwaggerModule');
      expect(result).not.toContain('@nestjs/swagger');
      // Original content should remain
      expect(result).toContain('await app.listen');
      expect(result).toContain('NestFactory');
    });

    it('should be a no-op if block does not exist', () => {
      writeMain(BASE_MAIN);
      const before = readMain();

      removeBlock(mainTsPath, 'nonexistent', []);

      const after = readMain();
      expect(before).toBe(after);
    });

    it('should remove one block while preserving another', () => {
      writeMain(BASE_MAIN);

      insertBlock(mainTsPath, 'swagger-setup', {
        imports: [
          {
            namedImports: ['DocumentBuilder', 'SwaggerModule'],
            moduleSpecifier: '@nestjs/swagger',
          },
        ],
        code: `  SwaggerModule.setup('api/docs', app, {});`,
      });

      insertBlock(mainTsPath, 'compression-setup', {
        imports: [],
        code: '  await app.register(compression);',
      });

      removeBlock(mainTsPath, 'swagger-setup', ['@nestjs/swagger']);

      const result = readMain();
      expect(result).not.toContain('// --- swagger-setup start ---');
      expect(result).toContain('// --- compression-setup start ---');
      expect(result).toContain('await app.register(compression)');
    });
  });

  describe('snapshots', () => {
    it('should match snapshot after inserting swagger block into main.ts', () => {
      writeMain(BASE_MAIN);

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

      expect(readMain()).toMatchSnapshot();
    });
  });
});
