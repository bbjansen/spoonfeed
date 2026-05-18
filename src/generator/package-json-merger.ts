export interface PackageJsonFragment {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function sortKeys(obj: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

export function mergePackageJson(
  base: Record<string, unknown>,
  fragments: PackageJsonFragment[],
): Record<string, unknown> {
  const result = { ...base };

  let deps = { ...((base.dependencies as Record<string, string>) ?? {}) };
  let devDeps = {
    ...((base.devDependencies as Record<string, string>) ?? {}),
  };
  let scripts = { ...((base.scripts as Record<string, string>) ?? {}) };

  for (const fragment of fragments) {
    if (fragment.dependencies) {
      deps = { ...deps, ...fragment.dependencies };
    }
    if (fragment.devDependencies) {
      devDeps = { ...devDeps, ...fragment.devDependencies };
    }
    if (fragment.scripts) {
      scripts = { ...scripts, ...fragment.scripts };
    }
  }

  // Remove packages from devDeps that are already in deps (runtime takes precedence)
  for (const key of Object.keys(deps)) {
    delete devDeps[key];
  }

  result.dependencies = sortKeys(deps);
  result.devDependencies = sortKeys(devDeps);
  if (Object.keys(scripts).length > 0) {
    result.scripts = sortKeys(scripts);
  }

  return result;
}
