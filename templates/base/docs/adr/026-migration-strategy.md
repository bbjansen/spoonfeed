# ADR-026: Database Migration Strategy (Lambda Runner Pattern)

## Status

Accepted

## Date

2026-05-01

## Context

Database migrations in serverless deployments cannot run via traditional CLI commands (`typeorm migration:run`) because there is no persistent server process. Migrations must execute before the application starts serving traffic, with validation that they succeeded. Running migrations at application startup is risky — multiple concurrent Lambda instances could race on the same migration.

## Decision

Use a dedicated migration-runner Lambda function that executes database migrations as a discrete pipeline step. Key design choices:

- **Pipeline integration:** deploy migration-runner Lambda, invoke it, validate exit code, then deploy the application Lambda. If migration fails, the pipeline halts before the new application code is deployed
- **ORM-agnostic architecture:** the migration runner is a thin wrapper that calls the ORM's migration API programmatically (`dataSource.runMigrations()` for TypeORM) rather than shelling out to CLI commands
- **Barrel file pattern:** TypeORM with esbuild/Lambda requires explicit migration imports via a barrel file (`migrations/index.ts` re-exporting all migration classes) because esbuild cannot resolve TypeORM's glob-based migration discovery
- **Local dev CLI:** developers use the standard `typeorm migration:run` CLI locally; the Lambda handler and CLI entrypoint share the same `DataSource` configuration but have separate entrypoints
- **Idempotency:** TypeORM's migration table (`migrations`) tracks executed migrations; re-invoking the runner is safe

## Consequences

### Positive

- Migrations run exactly once before application deployment — no race conditions from concurrent instances
- Pipeline can gate deployment on migration success, preventing schema-code mismatches
- Same migration code runs locally (CLI) and in production (Lambda) — no environment-specific migration logic
- Barrel file pattern works reliably with esbuild tree-shaking and bundling

### Negative

- Additional Lambda function to deploy and maintain
- Barrel file must be manually updated when adding new migrations (or automated via codegen script)
- Pipeline is slightly slower due to the additional deploy-invoke-validate step

### Risks

- Migration timeout on large tables — mitigated by setting Lambda timeout to 15 minutes and using batched DDL operations
- Barrel file drift (missing migration) — mitigated by a CI check that verifies all migration files are re-exported

## Alternatives Considered

### Run migrations at application startup

- **Pros:** simpler deployment, no extra Lambda
- **Cons:** race conditions with multiple instances, startup latency, failed migration leaves app in broken state
- **Why not:** unsafe in multi-instance serverless environments

## References

- ADR-003: Database Strategy
- ADR-005: Deployment Strategy
- ADR-014: Build Toolchain
