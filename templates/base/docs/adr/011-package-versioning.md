# ADR-011: Exact Dependency Versions (No Ranges)

## Status

Accepted

## Date

2026-03-20

## Context

npm defaults to caret ranges (`^1.2.3`) which allow minor and patch updates. While this sounds convenient, it has caused production incidents when a patch release introduced breaking changes or was compromised (supply chain attack).

## Decision

Pin all dependency versions to exact values (`1.2.3`, not `^1.2.3`). Enforce via:

- `.npmrc` with `save-exact=true`
- Pre-commit hook checking for version ranges
- `pnpm install -E` for all package installations

## Consequences

### Positive

- **Reproducible builds** — Same versions in dev, CI, staging, and production
- **Security** — No automatic adoption of compromised patch releases
- **Auditability** — Every version change is an explicit commit with a changelog review
- **No surprises** — Builds never break from upstream changes

### Negative

- Manual dependency updates required (no automatic patch adoption)
- More frequent dependency update PRs
- Lockfile churn when updating multiple packages

### Risks

- Missing security patches — mitigated by Dependabot/Renovate recipe and `pnpm audit` in CI

## References

- [CLAUDE.md global rules](../../../CLAUDE.md) — "NEVER use version ranges"
