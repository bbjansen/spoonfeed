import * as fs from 'node:fs';
import * as path from 'node:path';

function addSection(filePath: string, recipeId: string, content: string): void {
  if (!fs.existsSync(filePath)) return;

  let fileContent = fs.readFileSync(filePath, 'utf-8');
  const marker = `<!-- @spoonfeed:${recipeId} -->`;
  if (fileContent.includes(marker)) return;

  const section = `\n${marker}\n${content}\n<!-- @spoonfeed:end:${recipeId} -->\n`;
  fileContent = fileContent.trimEnd() + '\n' + section;
  fs.writeFileSync(filePath, fileContent, 'utf-8');
}

function removeSection(filePath: string, recipeId: string): void {
  if (!fs.existsSync(filePath)) return;

  let fileContent = fs.readFileSync(filePath, 'utf-8');
  const startMarker = `<!-- @spoonfeed:${recipeId} -->`;
  const endMarker = `<!-- @spoonfeed:end:${recipeId} -->`;

  const startIdx = fileContent.indexOf(startMarker);
  const endIdx = fileContent.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  fileContent = fileContent.slice(0, startIdx) + fileContent.slice(endIdx + endMarker.length);
  fileContent = fileContent.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  fs.writeFileSync(filePath, fileContent, 'utf-8');
}

export function addClaudeMdSection(projectDir: string, recipeId: string, content: string): void {
  addSection(path.join(projectDir, 'CLAUDE.md'), recipeId, content);
}

export function removeClaudeMdSection(projectDir: string, recipeId: string): void {
  removeSection(path.join(projectDir, 'CLAUDE.md'), recipeId);
}

export function addCursorRules(projectDir: string, recipeId: string, rules: string): void {
  const dir = path.join(projectDir, '.cursor', 'rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${recipeId}.mdc`), rules, 'utf-8');
}

export function removeCursorRules(projectDir: string, recipeId: string): void {
  const filePath = path.join(projectDir, '.cursor', 'rules', `${recipeId}.mdc`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function addCopilotInstructions(
  projectDir: string,
  recipeId: string,
  content: string,
): void {
  addSection(path.join(projectDir, '.github', 'copilot-instructions.md'), recipeId, content);
}

export function removeCopilotInstructions(projectDir: string, recipeId: string): void {
  removeSection(path.join(projectDir, '.github', 'copilot-instructions.md'), recipeId);
}
