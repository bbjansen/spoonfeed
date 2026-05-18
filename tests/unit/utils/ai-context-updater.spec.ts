import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { addClaudeMdSection, removeClaudeMdSection } from '@spoonfeed/utils/ai-context-updater';

describe('ai-context-updater', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-ctx-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md'),
      '# CLAUDE.md\n\n## Package Manager\n\nAlways use pnpm.\n',
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add a section to CLAUDE.md', () => {
    addClaudeMdSection(tmpDir, 'swagger', '## Swagger\nDocs at /api/docs.');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('## Swagger');
    expect(content).toContain('Docs at /api/docs.');
  });

  it('should not duplicate sections', () => {
    addClaudeMdSection(tmpDir, 'swagger', '## Swagger\nDocs at /api/docs.');
    addClaudeMdSection(tmpDir, 'swagger', '## Swagger\nDocs at /api/docs.');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const matches = content.match(/<!-- @spoonfeed:swagger -->/g);
    expect(matches).toHaveLength(1);
  });

  it('should remove a section from CLAUDE.md', () => {
    addClaudeMdSection(tmpDir, 'swagger', '## Swagger\nDocs at /api/docs.');
    removeClaudeMdSection(tmpDir, 'swagger');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).not.toContain('## Swagger');
    expect(content).toContain('## Package Manager');
  });
});
