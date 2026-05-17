# ADR-016: Multi-Provider CI/CD Pipeline Strategy

## Status

Accepted

## Date

2026-04-01

## Context

Organizations standardize on different CI/CD platforms depending on their cloud provider and existing tooling. A boilerplate that only generates GitHub Actions workflows excludes teams on Azure DevOps, AWS, or GCP-native pipelines.

## Decision

Support four CI/CD providers via recipes: GitHub Actions, Azure DevOps Pipelines, AWS CodePipeline, and GCP Cloud Build. All providers implement the same standardized pipeline stages:

1. **Install** — dependency installation with lockfile caching
2. **Lint & Format** — ESLint + Prettier checks
3. **Type Check** — `tsc --noEmit`
4. **Unit Test** — Jest with coverage thresholds
5. **Build** — SWC compilation
6. **Integration Test** — against real services (database, cache)
7. **Docker Build** — multi-stage Dockerfile with layer caching
8. **Deploy** — environment-specific deployment (dev/staging/prod)

Database migrations run via a migration-runner Lambda (AWS) or equivalent serverless function that executes before the application deployment, ensuring schema changes are applied atomically and independently of the application lifecycle.

## Consequences

### Positive

- Teams use their existing CI/CD platform without manual pipeline authoring
- Standardized stages ensure consistent quality gates across all providers
- Migration-runner pattern decouples schema changes from application deploys
- Pipeline configs are generated with project-specific values (image names, regions, service names)

### Negative

- Four pipeline configurations to maintain and keep in sync
- Provider-specific features (GitHub Actions marketplace, Azure DevOps service connections) are underutilized to maintain portability
- Migration-runner adds an extra deployment artifact to manage

### Risks

- Pipeline syntax breaking changes in provider updates — mitigated by pinning action/task versions

## References

- Recipes: `github-actions`, `azure-devops`, `aws-codepipeline`, `gcp-cloud-build`
- ADR-005: Deployment Strategy
