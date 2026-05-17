# CI/CD Recipes

Continuous integration and deployment pipelines for NestJS applications.

## Available Recipes

| Recipe | Description                                                           | Recipe README                                             |
| ------ | --------------------------------------------------------------------- | --------------------------------------------------------- |
| CI/CD  | Pipeline templates for GitHub Actions, Azure DevOps, AWS CodePipeline | [ci-cd](../../packages/templates/recipes/ci-cd/README.md) |

## Comparison

| Feature            | GitHub Actions                      | Azure DevOps                  | AWS CodePipeline                     |
| ------------------ | ----------------------------------- | ----------------------------- | ------------------------------------ |
| Config format      | YAML (`.github/workflows/`)         | YAML (`azure-pipelines.yml`)  | JSON/YAML + Console                  |
| Runner options     | GitHub-hosted, self-hosted          | Microsoft-hosted, self-hosted | CodeBuild (managed)                  |
| Marketplace        | GitHub Marketplace (Actions)        | Azure DevOps Extensions       | Limited                              |
| Artifact storage   | GitHub Artifacts                    | Azure Artifacts               | S3                                   |
| Secrets management | GitHub Secrets                      | Variable Groups, Key Vault    | SSM Parameter Store, Secrets Manager |
| Free tier          | 2,000 min/month (public: unlimited) | 1,800 min/month               | 1 active pipeline free               |
| Best for           | Open source, GitHub-centric teams   | Azure/Microsoft shops         | AWS-native deployments               |

## Pipeline Stages

Every pipeline should include these stages:

```
Install --> Lint --> Test --> Build --> Deploy
```

| Stage   | Purpose                    | Typical Commands                          |
| ------- | -------------------------- | ----------------------------------------- |
| Install | Install dependencies       | `pnpm install --frozen-lockfile`          |
| Lint    | Static analysis            | `pnpm lint`                               |
| Test    | Unit + integration tests   | `pnpm test`                               |
| Build   | Compile TypeScript         | `pnpm build`                              |
| Deploy  | Push to target environment | Docker push, K8s apply, serverless deploy |

## GitHub Actions

```yaml
# .github/workflows/ci.yml
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
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

## Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [main]

pool:
  vmImage: ubuntu-latest

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  - script: corepack enable && pnpm install --frozen-lockfile
    displayName: Install
  - script: pnpm lint
    displayName: Lint
  - script: pnpm test
    displayName: Test
  - script: pnpm build
    displayName: Build
  - task: Docker@2
    displayName: Build and Push Image
    inputs:
      containerRegistry: $(dockerRegistry)
      repository: $(imageName)
      command: buildAndPush
      Dockerfile: Dockerfile
```

## AWS CodePipeline

```yaml
# buildspec.yml (CodeBuild)
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 20
    commands:
      - corepack enable
      - pnpm install --frozen-lockfile
  build:
    commands:
      - pnpm lint
      - pnpm test
      - pnpm build
      - docker build -t $ECR_REPO:$CODEBUILD_RESOLVED_SOURCE_VERSION .
      - docker push $ECR_REPO:$CODEBUILD_RESOLVED_SOURCE_VERSION
artifacts:
  files:
    - imagedefinitions.json
```

## Best Practices

- Cache `node_modules` and pnpm store between runs
- Run lint and tests in parallel where possible
- Use matrix builds to test across Node.js versions
- Pin action/task versions for reproducibility
- Store secrets in the platform's secret manager, never in pipeline files
- Use branch protection rules to require passing CI before merge

## External Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Azure Pipelines Documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/)
- [AWS CodePipeline Documentation](https://docs.aws.amazon.com/codepipeline/)
- [AWS CodeBuild Documentation](https://docs.aws.amazon.com/codebuild/)

## Related Recipes

- [Deployment](deployment.md) -- deployment targets for the CD stage
- [Dependabot/Renovate](../../packages/templates/recipes/dependabot-renovate/README.md) -- automated dependency updates
