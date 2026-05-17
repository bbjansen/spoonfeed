# ADR-015: Multi-Cloud Support via Composable Recipes

## Status

Accepted

## Date

2026-04-01

## Context

Teams deploy to different cloud providers depending on organizational standards. Locking the boilerplate to a single provider (e.g., AWS-only) would exclude a large portion of users and create vendor lock-in at the template level.

## Decision

Support AWS, GCP, and Azure as first-class cloud providers through composable recipes. Each cloud service is wrapped in a dedicated NestJS module that injects configuration via `ConfigService` and exposes a provider-agnostic interface where practical.

The CLI presents a `--cloud` flag (`aws`, `gcp`, `azure`) that pre-selects cloud-appropriate recipe defaults:

- **AWS:** `aws-s3`, `aws-sqs`, `aws-ses`, `aws-secrets-manager`, `aws-lambda-deploy`
- **GCP:** `gcp-cloud-storage`, `gcp-pub-sub`, `gcp-cloud-tasks`, `gcp-secret-manager`
- **Azure:** `azure-blob-storage`, `azure-service-bus`, `azure-key-vault`

Each cloud recipe declares conflicts with its counterparts (e.g., `aws-s3` conflicts with `gcp-cloud-storage`).

## Consequences

### Positive

- Teams choose their cloud without forking the boilerplate
- Cloud-aware CLI defaults reduce decision fatigue during scaffolding
- Service modules use `ConfigService` for credentials — no hardcoded provider SDKs in business logic
- Adding a new cloud service is a self-contained recipe contribution

### Negative

- Maintaining parity across three cloud providers multiplies recipe count
- Provider-agnostic interfaces can leak abstractions for provider-specific features
- Testing requires credentials or emulators for each cloud provider

### Risks

- SDK version drift across providers — mitigated by exact version pinning and per-provider CI test matrices

## References

- Recipe groups: `aws-*`, `gcp-*`, `azure-*`
- ADR-008: Composable Recipe System
