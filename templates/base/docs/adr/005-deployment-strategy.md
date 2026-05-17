# ADR-005: Multi-Target Deployment Templates

## Status

Accepted

## Date

2026-02-15

## Context

Projects deploy to different targets: Docker/Kubernetes for container orchestration, Serverless Framework for Lambda, Terraform for infrastructure-as-code. Each requires different config files.

## Decision

Provide deployment as selectable recipes during project scaffolding:

- `dockerfile` — Multi-stage Docker build with dumb-init
- `docker-compose` — Full-stack local dev with Postgres + Redis
- `kubernetes` — Deployment, Service, ConfigMap, Ingress, HPA manifests
- `serverless-framework` — AWS Lambda deployment
- `terraform` — ECS Fargate module with ALB, IAM, security groups

## Consequences

### Positive

- Teams get production-ready deployment configs out of the box
- Multiple targets can be selected (e.g., Dockerfile + Kubernetes)
- Terraform module is modular and extensible

### Negative

- Config files need customization for each project's specific infrastructure
- Kubernetes manifests assume nginx ingress class

### Risks

- Outdated base images — mitigated by Renovate/Dependabot recipe
