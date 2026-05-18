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
  return vars.map((v) => `# ${v.description}\n${v.key}=${v.defaultValue}`).join('\n\n') + '\n';
}

export interface EnvSection {
  sectionName: string;
  vars: EnvVar[];
}

/**
 * Renders env file with `# --- Section Name ---` delimiters around each recipe's
 * variables.  This keeps the format consistent with what add-recipe produces, so
 * remove-recipe can reliably strip a section later.
 */
export function renderEnvFileWithSections(
  baseVars: EnvVar[],
  sections: EnvSection[],
): string {
  const lines: string[] = [];

  // Base variables (no markers — they are never removed)
  for (const v of baseVars) {
    lines.push(`# ${v.description}`, `${v.key}=${v.defaultValue}`, '');
  }

  // Recipe sections with start/end markers
  // Sort sections by name for deterministic output regardless of recipe array order
  const sortedSections = [...sections].sort((a, b) =>
    a.sectionName.localeCompare(b.sectionName),
  );

  // Track which keys have been seen and which section first claimed them
  const seenKeys = new Map<string, string>();
  for (const v of baseVars) {
    seenKeys.set(v.key, 'base');
  }

  for (const section of sortedSections) {
    if (section.vars.length === 0) continue;
    lines.push(`# --- ${section.sectionName} ---`);
    for (const v of section.vars) {
      const claimedBy = seenKeys.get(v.key);
      if (claimedBy) {
        // Var already claimed — write as comment so the user sees the dependency
        const sharedNote =
          claimedBy === 'base' ? 'shared with base' : `shared with ${claimedBy}`;
        lines.push(`# ${v.key}=${v.defaultValue} (${sharedNote})`);
      } else {
        lines.push(`# ${v.description}`, `${v.key}=${v.defaultValue}`);
        seenKeys.set(v.key, section.sectionName);
      }
    }
    lines.push(`# --- end ${section.sectionName} ---`, '');
  }

  return lines.join('\n') + '\n';
}
