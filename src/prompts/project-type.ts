import * as p from '@clack/prompts';
import type { ProjectType } from '../types.js';

const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string; hint?: string }[] = [
  { value: 'http-api', label: 'HTTP REST API', hint: 'Fastify + Swagger' },
  { value: 'aws-lambda', label: 'AWS Lambda', hint: 'Serverless handler' },
  { value: 'microservice', label: 'Microservice', hint: 'Message-based' },
  { value: 'cli-app', label: 'CLI Application', hint: 'nest-commander' },
  { value: 'scheduled-worker', label: 'Scheduled Worker', hint: 'Cron + BullMQ' },
  { value: 'monorepo', label: 'Monorepo', hint: 'Nx workspace' },
  { value: 'full-stack', label: 'Full-Stack', hint: 'NestJS + frontend' },
];

export async function promptProjectType(): Promise<ProjectType> {
  const result = await p.select({
    message: 'What type of project are you building?',
    options: PROJECT_TYPE_OPTIONS,
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return result;
}
