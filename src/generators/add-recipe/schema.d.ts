export interface AddRecipeGeneratorSchema {
  recipe: string;
  project?: string;
  dryRun?: boolean;
  skipInstall?: boolean;
}
