#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import { runAllPrompts } from './prompts/run-all.js';
import { validateConfig } from './validation/config-validator.js';
import { generate } from './generator/generator.js';
import { runPostGenerate } from './generator/post-generate.js';
import { RecipeRegistry } from './recipes/registry.js';
import { registerAllRecipes } from './recipes/definitions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  p.intro('spoonfeeder — NestJS Project Generator');

  const registry = new RecipeRegistry();
  registerAllRecipes(registry);

  const config = await runAllPrompts(registry);
  if (!config) {
    p.outro('No project generated.');
    return;
  }

  const validation = validateConfig(config);
  if (!validation.success) {
    for (const error of validation.errors) {
      p.log.error(`${error.field}: ${error.message}`);
    }
    process.exit(1);
  }

  const templatesDir = path.resolve(__dirname, '../templates');
  await generate(config, registry, templatesDir);
  await runPostGenerate(config.outputDir);

  const nextSteps = `cd ${config.name}\npnpm start:dev`;
  p.note(nextSteps, 'Next steps');

  p.outro('Project created successfully!');
}

main().catch((err: unknown) => {
  p.log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
