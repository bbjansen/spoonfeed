import * as p from '@clack/prompts';
import type { CloudProvider } from '../types.js';

export async function promptCloudProvider(): Promise<CloudProvider> {
  const result = await p.select({
    message: 'Select a cloud provider default:',
    options: [
      { value: 'aws', label: 'AWS', hint: 'pre-selects AWS services' },
      { value: 'gcp', label: 'GCP', hint: 'pre-selects GCP services' },
      { value: 'azure', label: 'Azure', hint: 'pre-selects Azure services' },
      { value: 'none', label: 'None', hint: 'pick individually' },
    ],
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return result;
}
