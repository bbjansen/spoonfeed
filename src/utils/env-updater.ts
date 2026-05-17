import * as fs from 'node:fs';
import * as path from 'node:path';

export interface EnvVarEntry {
  key: string;
  defaultValue: string;
  description: string;
}

const ENV_FILE = '.env.example';

export function addEnvSection(projectDir: string, sectionName: string, vars: EnvVarEntry[]): void {
  const filePath = path.join(projectDir, ENV_FILE);
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

  const marker = `# --- ${sectionName} ---`;
  if (content.includes(marker)) return; // Idempotent

  const section = [
    '',
    marker,
    ...vars.map((v) => `# ${v.description}\n${v.key}=${v.defaultValue}`),
    `# --- end ${sectionName} ---`,
    '',
  ].join('\n');

  content = content.trimEnd() + '\n' + section;
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function removeEnvSection(projectDir: string, sectionName: string): void {
  const filePath = path.join(projectDir, ENV_FILE);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  const startMarker = `# --- ${sectionName} ---`;
  const endMarker = `# --- end ${sectionName} ---`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
  content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');
}
