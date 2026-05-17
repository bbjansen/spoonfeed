import * as p from '@clack/prompts';
import type { ProjectConfig } from '../types.js';

export async function promptConfirmation(config: ProjectConfig): Promise<boolean> {
  const lines = [
    `Project:    ${config.scope ? config.scope + '/' : ''}${config.name}`,
    `Type:       ${config.projectType}`,
    `Cloud:      ${config.cloudProvider}`,
    `Add-ons:    ${config.recipes.length > 0 ? config.recipes.join(', ') : 'none'}`,
    `Deploy:     ${config.deploymentTargets.length > 0 ? config.deploymentTargets.join(', ') : 'none'}`,
    `CI/CD:      ${config.ciCdProvider ?? 'none'}`,
    `Directory:  ${config.outputDir}`,
  ];

  if (config.transportLayer) {
    lines.splice(2, 0, `Transport:  ${config.transportLayer}`);
  }
  if (config.frontendFramework) {
    lines.splice(2, 0, `Frontend:   ${config.frontendFramework}`);
  }

  p.note(lines.join('\n'), 'Configuration');

  const confirmed = await p.confirm({
    message: 'Generate project?',
    initialValue: true,
  });

  if (p.isCancel(confirmed)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return confirmed;
}
