export interface MigrateRecipeGeneratorSchema {
  from: string;
  to: string;
  project?: string;
  dryRun?: boolean;
}
