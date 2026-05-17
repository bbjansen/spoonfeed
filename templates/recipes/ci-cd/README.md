# CI/CD

Continuous integration and deployment pipeline templates for NestJS projects.

## Providers

| Provider                                | Description                                        |
| --------------------------------------- | -------------------------------------------------- |
| [GitHub Actions](./github-actions/)     | Workflow files for GitHub-hosted CI/CD             |
| [Azure DevOps](./azure-devops/)         | Stage-based pipeline for Azure DevOps              |
| [AWS CodePipeline](./aws-codepipeline/) | Build specification for AWS CodeBuild/CodePipeline |
| [GCP Cloud Build](./gcp-cloudbuild/)    | Pipeline configuration for Google Cloud Build      |

Each provider includes preconfigured pipelines with install, lint, type-check, test, build, and security audit steps.
