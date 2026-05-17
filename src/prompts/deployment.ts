import * as p from '@clack/prompts';
import type { DeploymentTarget } from '../types.js';

export async function promptDeployment(): Promise<DeploymentTarget[]> {
  const result = await p.multiselect({
    message: 'Select deployment targets:',
    options: [
      { value: 'dockerfile', label: 'Dockerfile', hint: 'Multi-stage build' },
      { value: 'docker-compose', label: 'docker-compose', hint: 'Local dev stack' },
      { value: 'kubernetes', label: 'Kubernetes', hint: 'Deployment manifests' },
      { value: 'serverless-framework', label: 'Serverless Framework' },
      { value: 'terraform', label: 'Terraform', hint: 'Infrastructure as Code' },
    ],
    required: false,
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return result;
}
