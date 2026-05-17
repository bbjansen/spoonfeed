import { z } from 'zod';
import {
  PROJECT_TYPES,
  CLOUD_PROVIDERS,
  TRANSPORT_LAYERS,
  FRONTEND_FRAMEWORKS,
  DEPLOYMENT_TARGETS,
  CI_CD_PROVIDERS,
  RECIPE_IDS,
} from '../types.js';
import type { ProjectConfig } from '../types.js';

const projectNameRegex = /^[a-z0-9][a-z0-9-]*$/;

const projectConfigSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Project name is required')
      .regex(projectNameRegex, 'Use lowercase letters, numbers, and hyphens only'),
    scope: z
      .string()
      .regex(/^@[a-z0-9-]+$/, 'Scope must start with @ and use lowercase')
      .optional(),
    projectType: z.enum(PROJECT_TYPES),
    cloudProvider: z.enum(CLOUD_PROVIDERS),
    recipes: z.array(z.enum(RECIPE_IDS)),
    transportLayer: z.enum(TRANSPORT_LAYERS).optional(),
    frontendFramework: z.enum(FRONTEND_FRAMEWORKS).optional(),
    deploymentTargets: z.array(z.enum(DEPLOYMENT_TARGETS)),
    ciCdProvider: z.enum(CI_CD_PROVIDERS).optional(),
    outputDir: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.projectType === 'microservice' && !data.transportLayer) {
      ctx.addIssue({
        code: 'custom',
        message: 'Transport layer is required for microservice projects',
        path: ['transportLayer'],
      });
    }
    if (data.projectType === 'full-stack' && !data.frontendFramework) {
      ctx.addIssue({
        code: 'custom',
        message: 'Frontend framework is required for full-stack projects',
        path: ['frontendFramework'],
      });
    }
  });

export interface ConfigValidationError {
  field: string;
  message: string;
}

export type ConfigValidationResult =
  | { success: true; config: ProjectConfig }
  | { success: false; errors: ConfigValidationError[] };

export function validateConfig(config: ProjectConfig): ConfigValidationResult {
  const result = projectConfigSchema.safeParse(config);

  if (result.success) {
    return { success: true, config: result.data as ProjectConfig };
  }

  const errors: ConfigValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));

  return { success: false, errors };
}
