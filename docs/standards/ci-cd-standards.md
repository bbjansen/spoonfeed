# CI/CD Standards

## Pipeline Stages

Every pipeline runs these stages in order. A failure in any stage stops the pipeline.

```
lint → type-check → test → build → deploy
```

| Stage      | Command            | Purpose                            |
| ---------- | ------------------ | ---------------------------------- |
| Lint       | `pnpm lint`        | Enforce code style and conventions |
| Type-check | `pnpm build` (tsc) | Catch type errors                  |
| Test       | `pnpm test:all`    | Run unit + integration + e2e tests |
| Build      | `pnpm build`       | Compile production artifacts       |
| Deploy     | Varies by env      | Deploy to target environment       |

### Example GitHub Actions Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm exec tsc --noEmit

      - name: Unit tests
        run: pnpm test

      - name: Integration tests
        run: pnpm test:integration

      - name: Build
        run: pnpm build
```

## Branch Strategy

```
feature/PROJ-123/description  ──PR──→  main  ──deploy──→  dev → staging → production
```

| Branch      | Purpose                    | Deploys To | Protected |
| ----------- | -------------------------- | ---------- | --------- |
| `main`      | Integration branch         | dev        | Yes       |
| `feature/*` | Feature development        | --         | No        |
| `fix/*`     | Bug fixes                  | --         | No        |
| `hotfix/*`  | Emergency production fixes | production | Yes       |

### Rules

- All changes enter `main` via pull request
- PRs require passing CI and at least one approval
- Direct pushes to `main` are blocked
- Hotfix branches are created from the production tag and merged to both production and main

## Environment Promotion

```
dev  →  staging  →  production
```

| Environment | Trigger          | Approval    | Data            |
| ----------- | ---------------- | ----------- | --------------- |
| Dev         | Merge to `main`  | Automatic   | Synthetic/seed  |
| Staging     | Manual promotion | Team lead   | Anonymized copy |
| Production  | Manual promotion | 2 approvals | Live data       |

### Promotion Commands

```bash
# Promote dev → staging (via GitHub Actions dispatch or CLI)
gh workflow run deploy --ref main -f environment=staging

# Promote staging → production
gh workflow run deploy --ref main -f environment=production
```

### Deployment Workflow

```yaml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [dev, staging, production]
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Deploy
        run: ./scripts/deploy.sh ${{ github.event.inputs.environment }}
```

## Secrets Management

### Rules

- Never store secrets in code, config files, or environment files committed to git
- Use the platform's secret manager (GitHub Secrets, AWS SSM, Vault)
- Rotate secrets on a regular schedule (90 days for credentials)
- Use separate secrets per environment

### GitHub Actions Secrets

```yaml
env:
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### AWS Systems Manager Parameter Store

```bash
# Store a secret
aws ssm put-parameter \
  --name "/myapp/production/DB_PASSWORD" \
  --value "secret-value" \
  --type SecureString

# Retrieve in application
process.env.DB_PASSWORD  # Injected by ECS task definition or Lambda config
```

### Secret Scanning

Run Gitleaks in CI to catch accidentally committed secrets:

```yaml
- name: Secret scan
  run: gitleaks detect --source . --exit-code 1
```

## Rollback Procedures

### Immediate Rollback

If a deployment causes issues, roll back to the previous version:

```bash
# Docker/ECS: redeploy previous task definition
aws ecs update-service \
  --cluster my-cluster \
  --service my-service \
  --task-definition my-task:previous-revision

# Kubernetes: rollback deployment
kubectl rollout undo deployment/my-app

# Serverless: rollback to previous version
pnpm sls rollback --timestamp 1234567890
```

### Rollback Checklist

1. Confirm the issue is caused by the deployment (not upstream)
2. Roll back the deployment using the method above
3. Verify the service is healthy after rollback
4. Create a hotfix branch from the last known good state
5. Fix the issue with tests
6. Deploy through the normal pipeline

### Database Migrations

- Migrations must be backward-compatible (additive only)
- Never drop columns or tables in the same release that removes code using them
- Use a two-phase approach: first deploy code that stops using the column, then deploy the migration that drops it
