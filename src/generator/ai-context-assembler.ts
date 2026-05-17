import path from 'node:path';
import fs from 'fs-extra';
import type { RecipeDefinition, ProjectConfig } from '../types.js';

export async function assembleClaudeMd(
  outputDir: string,
  config: ProjectConfig,
  recipes: RecipeDefinition[],
): Promise<void> {
  const sections = [
    '# CLAUDE.md',
    '',
    '## Package Manager',
    '',
    'Always use **pnpm**. Never use npm or yarn.',
    '',
    '## Imports',
    '',
    'Use the `@/*` alias for all internal imports — it maps to `src/*`.',
    '',
    `## Project Type`,
    '',
    `This is a ${config.projectType} project.`,
    '',
  ];

  if (recipes.length > 0) {
    sections.push('## Active Recipes', '');
    for (const recipe of recipes) {
      sections.push(`- **${recipe.name}** — ${recipe.description}`);
    }
    sections.push('');
  }

  for (const recipe of recipes) {
    if (recipe.claudeMdSection) {
      sections.push(recipe.claudeMdSection, '');
    }
  }

  await fs.writeFile(path.join(outputDir, 'CLAUDE.md'), sections.join('\n'), 'utf-8');
}

export async function assembleCursorRules(
  outputDir: string,
  recipes: RecipeDefinition[],
): Promise<void> {
  const rules = recipes.filter((r) => r.cursorRules).map((r) => r.cursorRules);

  if (rules.length === 0) return;

  const cursorDir = path.join(outputDir, '.cursor', 'rules');
  await fs.ensureDir(cursorDir);
  await fs.writeFile(path.join(cursorDir, 'project.mdc'), rules.join('\n\n'), 'utf-8');
}

export async function assembleCopilotInstructions(
  outputDir: string,
  recipes: RecipeDefinition[],
): Promise<void> {
  const instructions = recipes
    .filter((r) => r.copilotInstructions)
    .map((r) => r.copilotInstructions);

  if (instructions.length === 0) return;

  const githubDir = path.join(outputDir, '.github');
  await fs.ensureDir(githubDir);
  await fs.writeFile(
    path.join(githubDir, 'copilot-instructions.md'),
    instructions.join('\n\n'),
    'utf-8',
  );
}
