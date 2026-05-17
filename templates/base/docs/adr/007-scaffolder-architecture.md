# ADR-007: Generate-and-Own Scaffolder vs Config-as-Code (Projen)

## Status

Accepted

## Date

2026-02-25

## Context

We needed a tool to scaffold new NestJS projects with standardized patterns, recipes, and configurations. Two main approaches exist:

1. **Generate-and-own** — A CLI generates a project once. The generated files are fully owned by the team. No runtime dependency on the scaffolder.
2. **Config-as-code (Projen)** — Project configuration is managed by code. Running `npx projen` regenerates config files. Manual edits to managed files are overwritten.

[Projen](https://projen.io/) is the most popular config-as-code tool in the Node.js ecosystem, originally built for AWS CDK projects.

## Decision

Use the **generate-and-own** approach via `spoonfeeder`, a CLI scaffolder built with `@clack/prompts`.

## Consequences

### Positive

- **Zero lock-in** — Generated projects have no dependency on spoonfeeder
- **Full ownership** — Teams can modify any generated file (tsconfig, eslint, package.json) directly
- **No learning curve** — Developers edit files normally, no Projen API to learn
- **Composable recipes** — 100+ recipes can be mixed and matched at generation time
- **Framework-agnostic output** — Generated projects are standard NestJS, not Projen-managed

### Negative

- **No automatic updates** — When the boilerplate improves, existing projects don't get updates automatically
- **Drift** — Projects may diverge from the standard over time
- **One-time generation** — Adding a recipe after project creation requires manual integration

### Alternatives Considered

#### Projen

- **Pros:** Managed config files stay in sync, automatic dependency updates, synthesized from code
- **Cons:** High lock-in (manual edits overwritten), steep learning curve (must learn Projen API to change a tsconfig option), primarily designed for AWS CDK, team friction ("why can't I just edit package.json?")
- **Why not:** Our team prioritizes developer autonomy and minimal tooling. Projen's value proposition (managed config) becomes a liability when teams need to customize beyond what the Projen construct exposes.

#### Nx Generators

- **Pros:** Powerful AST transforms, can modify existing files safely, integrated with Nx workspace
- **Cons:** Requires Nx adoption for all projects, heavier than needed for one-time scaffolding
- **Why not:** Not all projects need Nx. The scaffolder should work for standalone apps too.

#### Yeoman

- **Pros:** Established ecosystem, full generator lifecycle
- **Cons:** Heavyweight, declining community, verbose API
- **Why not:** `@clack/prompts` provides a better developer experience with less code.

## References

- [Projen documentation](https://projen.io/)
- [@clack/prompts](https://github.com/bombshell-dev/clack)
- [create-t3-app](https://create.t3.gg/) — inspiration for the generate-and-own pattern
