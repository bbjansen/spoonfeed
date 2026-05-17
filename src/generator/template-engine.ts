import ejs from 'ejs';
import path from 'node:path';
import fs from 'fs-extra';

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return ejs.render(template, data);
}

export async function renderTemplateFile(
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  const template = await fs.readFile(templatePath, 'utf-8');
  return renderTemplate(template, data);
}

export async function renderAndWrite(
  templatePath: string,
  outputPath: string,
  data: Record<string, unknown>,
): Promise<void> {
  const rendered = await renderTemplateFile(templatePath, data);
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, rendered, 'utf-8');
}

export async function copyStatic(sourcePath: string, outputPath: string): Promise<void> {
  await fs.ensureDir(path.dirname(outputPath));
  await fs.copy(sourcePath, outputPath);
}
