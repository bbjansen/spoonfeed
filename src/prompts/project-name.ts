import * as p from '@clack/prompts';

export interface ProjectNameResult {
  name: string;
  scope: string | undefined;
}

export async function promptProjectName(): Promise<ProjectNameResult> {
  const name = await p.text({
    message: 'Project name:',
    placeholder: 'my-app',
    validate: (v) => {
      if (!v) return 'Project name is required';
      if (!/^[a-z0-9][a-z0-9-]*$/.test(v))
        return 'Use lowercase letters, numbers, and hyphens only';
    },
  });

  if (p.isCancel(name)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const scope = await p.text({
    message: 'Package scope (optional):',
    placeholder: '@myorg',
    validate: (v) => {
      if (v && !/^@[a-z0-9-]+$/.test(v)) return 'Scope must start with @ and use lowercase';
    },
  });

  if (p.isCancel(scope)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return {
    name: name,
    scope: scope || undefined,
  };
}
