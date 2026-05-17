import type { EnvVar } from '../types.js';

export function mergeEnvVars(base: EnvVar[], additions: EnvVar[][]): EnvVar[] {
  const merged = new Map<string, EnvVar>();

  for (const v of base) {
    merged.set(v.key, v);
  }

  for (const group of additions) {
    for (const v of group) {
      merged.set(v.key, v);
    }
  }

  return [...merged.values()];
}

export function renderEnvFile(vars: EnvVar[]): string {
  return vars.map((v) => `# ${v.description}\n${v.key}=${v.defaultValue}`).join('\n\n');
}
