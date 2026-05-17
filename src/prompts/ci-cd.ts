import * as p from '@clack/prompts';
import type { CiCdProvider } from '../types.js';

export async function promptCiCd(): Promise<CiCdProvider | undefined> {
  const result = await p.select({
    message: 'Select CI/CD provider:',
    options: [
      { value: 'github-actions', label: 'GitHub Actions' },
      { value: 'azure-devops', label: 'Azure DevOps' },
      { value: 'aws-codepipeline', label: 'AWS CodePipeline' },
      { value: 'gcp-cloudbuild', label: 'GCP Cloud Build' },
      { value: 'none', label: 'None' },
    ],
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return result === 'none' ? undefined : result;
}
