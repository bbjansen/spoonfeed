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
    '## Project',
    '',
    `**${config.scope ? config.scope + '/' : ''}${config.name}** — a ${config.projectType} project.`,
    ...(config.projectType === 'full-stack'
      ? [
          '',
          'Workspace layout:',
          '- `apps/api/` — NestJS API (backend)',
          `- \`apps/web/\` — ${config.frontendFramework ?? 'frontend'} (frontend)`,
        ]
      : config.projectType === 'monorepo'
        ? [
            '',
            'Workspace layout:',
            '- `apps/api/` — NestJS API',
          ]
        : []),
    '',
    '## Package Manager',
    '',
    'Always use **pnpm**. Never use npm or yarn.',
    '',
    '## Imports',
    '',
    (() => {
      const isWorkspace = config.projectType === 'full-stack' || config.projectType === 'monorepo';
      const aliasTarget = isWorkspace ? 'apps/api/src/*' : 'src/*';
      return `Use the \`@/*\` alias for all internal imports — it maps to \`${aliasTarget}\`.`;
    })(),
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
      sections.push(
        `<!-- @spoonfeed:${recipe.id} -->`,
        recipe.claudeMdSection,
        `<!-- @spoonfeed:end:${recipe.id} -->`,
        '',
      );
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
  const recipesWithInstructions = recipes.filter((r) => r.copilotInstructions);

  if (recipesWithInstructions.length === 0) return;

  const parts = recipesWithInstructions.map(
    (r) =>
      `<!-- @spoonfeed:${r.id} -->\n${r.copilotInstructions}\n<!-- @spoonfeed:end:${r.id} -->`,
  );

  const githubDir = path.join(outputDir, '.github');
  await fs.ensureDir(githubDir);
  await fs.writeFile(
    path.join(githubDir, 'copilot-instructions.md'),
    parts.join('\n\n') + '\n',
    'utf-8',
  );
}
