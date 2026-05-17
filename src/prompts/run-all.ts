import path from 'node:path';
import type { ProjectConfig, RecipeId, CloudProvider, ProjectType } from '../types.js';
import { RecipeRegistry } from '../recipes/registry.js';
import { promptProjectName } from './project-name.js';
import { promptProjectType } from './project-type.js';
import { promptCloudProvider } from './cloud-provider.js';
import { promptTransport } from './transport.js';
import { promptFrontend } from './frontend.js';
import { promptAddOns } from './add-ons.js';
import { promptDeployment } from './deployment.js';
import { promptCiCd } from './ci-cd.js';
import { promptConfirmation } from './confirmation.js';

// Best practice recipes — always pre-selected for applicable project types
const BEST_PRACTICES: RecipeId[] = [
  'helmet',
  'cors',
  'graceful-shutdown',
  'correlation-id',
  'request-logging',
];

// Per-project-type defaults
const PROJECT_TYPE_DEFAULTS: Record<ProjectType, RecipeId[]> = {
  'http-api': ['swagger', 'pino', 'health-checks', 'throttler'],
  'aws-lambda': ['pino'],
  microservice: ['pino', 'health-checks'],
  'cli-app': [],
  'scheduled-worker': ['bullmq', 'pino', 'health-checks'],
  monorepo: ['pino'],
  'full-stack': ['swagger', 'pino', 'health-checks'],
};

// Cloud-provider-specific defaults — pre-selected when provider is chosen
const CLOUD_DEFAULTS: Record<CloudProvider, RecipeId[]> = {
  aws: ['aws-secrets-manager', 'aws-s3'],
  gcp: ['gcp-secret-manager', 'gcp-cloud-storage'],
  azure: ['azure-key-vault', 'azure-blob-storage'],
  none: [],
};

function computeDefaults(
  projectType: ProjectType,
  cloudProvider: CloudProvider,
  availableRecipeIds: Set<RecipeId>,
): RecipeId[] {
  const combined = [
    ...BEST_PRACTICES,
    ...(PROJECT_TYPE_DEFAULTS[projectType] ?? []),
    ...CLOUD_DEFAULTS[cloudProvider],
  ];

  // Deduplicate and filter to only available (compatible) recipes
  return [...new Set(combined)].filter((id) => availableRecipeIds.has(id));
}

export async function runAllPrompts(registry: RecipeRegistry): Promise<ProjectConfig | null> {
  const { name, scope } = await promptProjectName();
  const projectType = await promptProjectType();
  const cloudProvider = await promptCloudProvider();

  let transportLayer: Awaited<ReturnType<typeof promptTransport>> | undefined = undefined;
  if (projectType === 'microservice') {
    transportLayer = await promptTransport();
  }

  let frontendFramework: Awaited<ReturnType<typeof promptFrontend>> | undefined = undefined;
  if (projectType === 'full-stack') {
    frontendFramework = await promptFrontend();
  }

  const availableRecipes = registry.getCompatibleWith(projectType);
  const availableIds = new Set(availableRecipes.map((r) => r.id));
  const defaults = computeDefaults(projectType, cloudProvider, availableIds);
  const recipes = await promptAddOns(availableRecipes, defaults);

  const deploymentTargets = await promptDeployment();
  const ciCdProvider = await promptCiCd();

  // Default output to parent directory to avoid generating inside the boilerplate repo
  const baseDir = process.cwd();
  const outputDir = path.resolve(baseDir, '..', name);

  const config: ProjectConfig = {
    name,
    scope,
    projectType,
    cloudProvider,
    recipes,
    transportLayer,
    frontendFramework,
    deploymentTargets,
    ciCdProvider,
    outputDir,
  };

  const confirmed = await promptConfirmation(config);
  if (!confirmed) return null;

  return config;
}
