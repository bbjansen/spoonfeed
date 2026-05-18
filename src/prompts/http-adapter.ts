import * as p from '@clack/prompts';
import type { HttpAdapter } from '../types.js';

export async function promptHttpAdapter(): Promise<HttpAdapter> {
  const result = await p.select({
    message: 'Which HTTP adapter?',
    options: [
      { value: 'fastify', label: 'Fastify', hint: 'High performance, schema-based validation' },
      { value: 'express', label: 'Express', hint: 'Mature ecosystem, widest middleware support' },
    ],
    initialValue: 'fastify' as HttpAdapter,
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return result;
}
