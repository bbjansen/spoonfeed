import type { RecipeDefinition } from '../types.js';

export type { RecipeDefinition };

export interface RecipeApplyContext {
  outputDir: string;
  templateDir: string;
  projectName: string;
  projectScope: string | undefined;
}
