import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RecipeManifestEntry {
  installedAt: string;
  version: string;
  files: string[];
  mainTsBlocks?: string[];
  envSection?: string;
  moduleImport?: {
    moduleName: string;
    importPath: string;
  };
}

export interface SpoonfeederManifest {
  projectType: string;
  cloudProvider: string;
  spoonfeederVersion: string;
  generatedAt: string;
  recipes: Record<string, RecipeManifestEntry>;
}

const MANIFEST_FILE = '.spoonfeeder.json';

export function readManifest(projectDir: string): SpoonfeederManifest | null {
  const filePath = path.join(projectDir, MANIFEST_FILE);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SpoonfeederManifest;
}

export function writeManifest(projectDir: string, manifest: SpoonfeederManifest): void {
  const filePath = path.join(projectDir, MANIFEST_FILE);
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

export function addRecipeToManifest(
  projectDir: string,
  recipeId: string,
  entry: Omit<RecipeManifestEntry, 'installedAt' | 'version'>,
): void {
  const manifest = readManifest(projectDir);
  if (!manifest) throw new Error('.spoonfeeder.json not found');

  manifest.recipes[recipeId] = {
    ...entry,
    installedAt: new Date().toISOString(),
    version: manifest.spoonfeederVersion,
  };

  writeManifest(projectDir, manifest);
}

export function removeRecipeFromManifest(projectDir: string, recipeId: string): void {
  const manifest = readManifest(projectDir);
  if (!manifest) throw new Error('.spoonfeeder.json not found');

  delete manifest.recipes[recipeId];
  writeManifest(projectDir, manifest);
}

export function isRecipeInstalled(projectDir: string, recipeId: string): boolean {
  const manifest = readManifest(projectDir);
  return !!manifest?.recipes[recipeId];
}

export function getInstalledRecipeIds(projectDir: string): string[] {
  const manifest = readManifest(projectDir);
  return manifest ? Object.keys(manifest.recipes) : [];
}
