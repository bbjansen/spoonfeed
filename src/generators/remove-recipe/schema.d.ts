export interface RemoveRecipeGeneratorSchema {
  recipe: string;
  project?: string;
  force?: boolean;
  dryRun?: boolean;
}
