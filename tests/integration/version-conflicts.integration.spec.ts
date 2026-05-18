import * as fs from 'node:fs';
import * as path from 'node:path';
import { RecipeRegistry } from '@spoonfeed/recipes/registry';
import { registerAllRecipes } from '@spoonfeed/recipes/definitions';
import type { RecipeDefinition } from '@spoonfeed/types';

jest.mock('@clack/prompts', () => ({
  spinner: () => ({ start: jest.fn(), stop: jest.fn() }),
  log: { warning: jest.fn() },
}));

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

interface VersionEntry {
  source: string;
  version: string;
}

function createRegistry(): RecipeRegistry {
  const registry = new RecipeRegistry();
  registerAllRecipes(registry);
  return registry;
}

/**
 * Parse the base package.json.ejs template with regex.
 * Lines wrapped in EJS conditionals (e.g. `<% if (httpAdapter === 'express') { %>`)
 * are still valid declarations -- they will be present for *some* adapter, so we
 * include them and label the source accordingly.
 */
function parseBasePackageJson(): Map<string, VersionEntry[]> {
  const map = new Map<string, VersionEntry[]>();
  const ejsPath = path.join(TEMPLATES_DIR, 'base/package.json.ejs');
  const content = fs.readFileSync(ejsPath, 'utf-8');

  // Match lines like:  "package-name": "1.2.3"
  const depRegex = /"([^"]+)":\s*"(\d[^"]*)"/g;
  let match: RegExpExecArray | null;

  // Track which JSON section we're in
  let inDeps = false;
  let inDevDeps = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === '"dependencies": {') inDeps = true;
    if (trimmed === '"devDependencies": {') inDevDeps = true;

    if ((inDeps || inDevDeps) && trimmed === '},') {
      if (inDevDeps) inDevDeps = false;
      else inDeps = false;
    }

    if (!inDeps && !inDevDeps) continue;

    // Skip pure EJS control lines
    if (trimmed.startsWith('<%') && !trimmed.includes('"')) continue;

    match = depRegex.exec(trimmed);
    if (match) {
      const [, pkg, version] = match;
      // Skip keys that are section headers
      if (pkg === 'dependencies' || pkg === 'devDependencies') continue;

      const source = 'base';
      if (!map.has(pkg)) map.set(pkg, []);
      map.get(pkg)!.push({ source, version });
    }
    depRegex.lastIndex = 0;
  }

  return map;
}

/**
 * Parse project-type package-fragment.json files for additional dependencies.
 */
function parseProjectFragments(): Map<string, VersionEntry[]> {
  const map = new Map<string, VersionEntry[]>();
  const projectTypesDir = path.join(TEMPLATES_DIR, 'project-types');

  if (!fs.existsSync(projectTypesDir)) return map;

  const dirs = fs.readdirSync(projectTypesDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const fragmentPath = path.join(projectTypesDir, dir.name, 'package-fragment.json');
    if (!fs.existsSync(fragmentPath)) continue;

    const content = JSON.parse(fs.readFileSync(fragmentPath, 'utf-8'));
    const source = `project-type/${dir.name}`;

    for (const section of ['dependencies', 'devDependencies'] as const) {
      const deps = content[section];
      if (!deps) continue;
      for (const [pkg, version] of Object.entries(deps)) {
        if (!map.has(pkg)) map.set(pkg, []);
        map.get(pkg)!.push({ source, version: version as string });
      }
    }
  }

  return map;
}

/**
 * Build a complete map of all package version declarations across every source.
 */
function buildVersionMap(recipes: RecipeDefinition[]): Map<string, VersionEntry[]> {
  const map = parseBasePackageJson();

  // Project-type fragments
  const fragments = parseProjectFragments();
  for (const [pkg, entries] of fragments) {
    if (!map.has(pkg)) map.set(pkg, []);
    map.get(pkg)!.push(...entries);
  }

  // Recipes
  for (const recipe of recipes) {
    for (const [pkg, version] of Object.entries(recipe.dependencies)) {
      if (!map.has(pkg)) map.set(pkg, []);
      map.get(pkg)!.push({ source: recipe.id, version });
    }

    for (const [pkg, version] of Object.entries(recipe.devDependencies)) {
      if (!map.has(pkg)) map.set(pkg, []);
      map.get(pkg)!.push({ source: `${recipe.id}/dev`, version });
    }

    if (recipe.expressDependencies) {
      for (const [pkg, version] of Object.entries(recipe.expressDependencies)) {
        if (!map.has(pkg)) map.set(pkg, []);
        map.get(pkg)!.push({ source: `${recipe.id}/express`, version });
      }
    }
  }

  return map;
}

/**
 * Find all packages declared more than once with differing versions.
 */
function findConflicts(versionMap: Map<string, VersionEntry[]>): Map<string, VersionEntry[]> {
  const conflicts = new Map<string, VersionEntry[]>();

  for (const [pkg, entries] of versionMap) {
    if (entries.length < 2) continue;

    const uniqueVersions = new Set(entries.map((e) => e.version));
    if (uniqueVersions.size > 1) {
      conflicts.set(pkg, entries);
    }
  }

  return conflicts;
}

/**
 * Check whether two recipes conflict with each other according to the registry.
 */
function recipesConflict(a: RecipeDefinition, b: RecipeDefinition): boolean {
  return a.conflicts.includes(b.id) || b.conflicts.includes(a.id);
}

/**
 * Format conflict entries into a readable string.
 */
function formatConflict(pkg: string, entries: VersionEntry[]): string {
  const deduped = new Map<string, string>();
  for (const e of entries) {
    deduped.set(e.source, e.version);
  }
  const parts = [...deduped.entries()].map(([src, ver]) => `${src}@${ver}`);
  return `${pkg}: ${parts.join(' vs ')}`;
}

describe('Package version conflict detection', () => {
  let recipes: RecipeDefinition[];
  let recipeMap: Map<string, RecipeDefinition>;
  let versionMap: Map<string, VersionEntry[]>;
  let allConflicts: Map<string, VersionEntry[]>;

  beforeAll(() => {
    const registry = createRegistry();
    recipes = registry.getAll();
    recipeMap = new Map(recipes.map((r) => [r.id, r]));
    versionMap = buildVersionMap(recipes);
    allConflicts = findConflicts(versionMap);
  });

  it('should have no version conflicts between base and any recipe', () => {
    const violations: string[] = [];

    for (const [pkg, entries] of allConflicts) {
      const baseEntries = entries.filter((e) => e.source === 'base');
      const recipeEntries = entries.filter((e) => e.source !== 'base' && !e.source.startsWith('project-type/'));

      if (baseEntries.length === 0 || recipeEntries.length === 0) continue;

      const baseVersion = baseEntries[0].version;
      for (const re of recipeEntries) {
        if (re.version !== baseVersion) {
          violations.push(`${pkg}: base@${baseVersion} vs ${re.source}@${re.version}`);
        }
      }
    }

    if (violations.length > 0) {
      fail(
        `Base package.json.ejs has version conflicts with recipes:\n  - ${violations.join('\n  - ')}`,
      );
    }
  });

  it('should have no version conflicts between non-conflicting recipes', () => {
    const violations: string[] = [];

    for (const [pkg, entries] of allConflicts) {
      // Only consider recipe sources (not base, not project-type fragments)
      const recipeEntries = entries.filter(
        (e) => e.source !== 'base' && !e.source.startsWith('project-type/'),
      );
      if (recipeEntries.length < 2) continue;

      // Group entries by their version
      const byVersion = new Map<string, string[]>();
      for (const e of recipeEntries) {
        if (!byVersion.has(e.version)) byVersion.set(e.version, []);
        byVersion.get(e.version)!.push(e.source);
      }
      if (byVersion.size < 2) continue;

      // Check every pair of sources with differing versions
      const versionGroups = [...byVersion.entries()];
      for (let i = 0; i < versionGroups.length; i++) {
        for (let j = i + 1; j < versionGroups.length; j++) {
          const [versionA, sourcesA] = versionGroups[i];
          const [versionB, sourcesB] = versionGroups[j];

          for (const srcA of sourcesA) {
            for (const srcB of sourcesB) {
              // Extract recipe ID from source (strip /dev, /express suffixes)
              const recipeIdA = srcA.replace(/\/(dev|express)$/, '');
              const recipeIdB = srcB.replace(/\/(dev|express)$/, '');

              // Skip if same recipe (deps vs devDeps)
              if (recipeIdA === recipeIdB) continue;

              const defA = recipeMap.get(recipeIdA);
              const defB = recipeMap.get(recipeIdB);

              // If either recipe is not found, skip (project-type fragments handled above)
              if (!defA || !defB) continue;

              // Only flag if the two recipes do NOT conflict with each other
              if (!recipesConflict(defA, defB)) {
                violations.push(`${pkg}: ${srcA}@${versionA} vs ${srcB}@${versionB}`);
              }
            }
          }
        }
      }
    }

    // Deduplicate (A vs B and B vs A)
    const unique = [...new Set(violations)];

    if (unique.length > 0) {
      fail(
        `Non-conflicting recipes declare the same package with different versions:\n  - ${unique.join('\n  - ')}`,
      );
    }
  });

  it('should log all version conflicts as warnings (informational)', () => {
    if (allConflicts.size === 0) {
      // No conflicts at all -- nothing to report
      return;
    }

    const lines: string[] = [];
    for (const [pkg, entries] of allConflicts) {
      lines.push(formatConflict(pkg, entries));
    }

    // Log all conflicts for developer awareness -- this test always passes
    console.warn(
      `\n[INFO] ${allConflicts.size} package(s) have version conflicts across sources:\n  - ${lines.join('\n  - ')}\n`,
    );
  });
});
