# GitHub Actions

CI/CD workflow files for GitHub Actions.

## Documentation

- [GitHub Actions](https://docs.github.com/en/actions)
- [Workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

## Generated Files

| File                       | Description                     |
| -------------------------- | ------------------------------- |
| `.github/workflows/ci.yml` | Continuous integration workflow |
| `.github/workflows/cd.yml` | Continuous deployment workflow  |

## CI Pipeline Stages

1. **Install** -- checkout, set up pnpm and Node.js, install frozen lockfile
2. **Lint** -- run ESLint
3. **Type check** -- `tsc --noEmit`
4. **Unit tests** -- `pnpm test:unit`
5. **Integration tests** -- `pnpm test:integration` with a Postgres service container
6. **Build** -- compile to `dist/`
7. **Security audit** -- `pnpm audit --audit-level=high`

## CD Pipeline

Triggers on push to `main`. Installs dependencies, builds the project, then deploys to the configured production environment. Add your deployment steps (Docker push, Kubernetes deploy, Lambda deploy, etc.) to the placeholder in `cd.yml`.
