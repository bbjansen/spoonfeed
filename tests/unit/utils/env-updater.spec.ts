import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { addEnvSection, removeEnvSection } from '@spoonfeed/utils/env-updater';

describe('env-updater', () => {
  let tmpDir: string;
  let envPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'));
    envPath = path.join(tmpDir, '.env.example');
    fs.writeFileSync(envPath, '# Application\nPORT=3000\nNODE_ENV=development\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add an env section', () => {
    addEnvSection(tmpDir, 'Redis', [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
      { key: 'REDIS_PORT', defaultValue: '6379', description: 'Redis port' },
    ]);

    const content = fs.readFileSync(envPath, 'utf-8');
    expect(content).toContain('# --- Redis ---');
    expect(content).toContain('REDIS_HOST=localhost');
    expect(content).toContain('REDIS_PORT=6379');
  });

  it('should not duplicate sections', () => {
    addEnvSection(tmpDir, 'Redis', [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
    ]);
    addEnvSection(tmpDir, 'Redis', [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
    ]);

    const content = fs.readFileSync(envPath, 'utf-8');
    const matches = content.match(/# --- Redis ---/g);
    expect(matches).toHaveLength(1);
  });

  it('should remove an env section', () => {
    addEnvSection(tmpDir, 'Redis', [
      { key: 'REDIS_HOST', defaultValue: 'localhost', description: 'Redis host' },
    ]);
    removeEnvSection(tmpDir, 'Redis');

    const content = fs.readFileSync(envPath, 'utf-8');
    expect(content).not.toContain('# --- Redis ---');
    expect(content).not.toContain('REDIS_HOST');
    expect(content).toContain('PORT=3000');
  });
});
