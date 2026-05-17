# Azure DevOps Pipelines

Stage-based CI/CD pipeline for Azure DevOps.

## Documentation

- [Azure Pipelines](https://learn.microsoft.com/en-us/azure/devops/pipelines/)
- [YAML schema reference](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/)

## Generated Files

| File                  | Description                 |
| --------------------- | --------------------------- |
| `azure-pipelines.yml` | Multi-stage pipeline config |

## Pipeline Stages

### CI Stage

Runs on every push and pull request to `main`:

1. **Install** -- set up Node.js and pnpm, install frozen lockfile
2. **Lint** -- run ESLint
3. **Type check** -- `tsc --noEmit`
4. **Unit tests** -- `pnpm test:unit`
5. **Integration tests** -- `pnpm test:integration` with a Postgres service container
6. **Build** -- compile to `dist/`
7. **Security audit** -- `pnpm audit --audit-level=high`

### Deploy Stage

Runs after a successful CI stage on the `main` branch only. Uses an Azure DevOps deployment environment named `production` with a `runOnce` strategy. Add your deployment steps to the placeholder.
