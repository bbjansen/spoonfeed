import * as p from '@clack/prompts';
import type { FrontendFramework } from '../types.js';

export async function promptFrontend(): Promise<FrontendFramework> {
  const result = await p.select({
    message: 'Which frontend framework?',
    options: [
      { value: 'nextjs', label: 'React (Next.js)', hint: 'SSR/SSG, App Router' },
      { value: 'vite-react', label: 'React (Vite SPA)', hint: 'Client-side SPA' },
      { value: 'nuxt', label: 'Vue (Nuxt)', hint: 'SSR/SSG, auto-imports' },
      { value: 'sveltekit', label: 'Svelte (SvelteKit)', hint: 'SSR/SSG, file-based routing' },
    ],
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return result;
}
