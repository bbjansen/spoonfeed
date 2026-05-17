# ADR-025: Opt-in Data Patterns (Soft Delete, Audit Trail, Outbox)

## Status

Accepted

## Date

2026-05-01

## Context

Production applications frequently need soft delete (logical deletion without data loss), audit trails (who changed what and when), and guaranteed event delivery (outbox pattern). These are cross-cutting concerns that not every service or entity needs — mandating them globally would add unnecessary complexity and storage overhead to simple CRUD entities.

## Decision

Provide each data pattern as a separate opt-in recipe that can be applied per entity or globally:

### Soft Delete

- TypeORM `@DeleteDateColumn()` on entities needing logical deletion; `softDelete(id)` / `restore(id)`
- Global query filter excludes soft-deleted rows by default; `withDeleted()` to include them

### Audit Trail

- `AuditInterceptor` captures entity snapshots before and after mutations, storing diffs in `audit_log`
- User context sourced from CLS (ADR-024); configurable per entity via `@Auditable()` decorator

### Transactional Outbox

- Events written to an `outbox` table in the same database transaction as the business write
- A poller or CDC process reads the outbox and publishes to the broker, preventing dual-write inconsistency

## Consequences

### Positive

- Each pattern is independently adoptable — no all-or-nothing commitment
- Soft delete preserves data for compliance and recovery without backup restores
- Audit trail provides a complete change history for regulatory and debugging purposes
- Outbox pattern eliminates the distributed transaction problem for event-driven architectures

### Negative

- Soft delete increases table sizes and requires `withDeleted()` awareness in queries
- Audit trail adds write amplification — every mutation produces an additional insert
- Outbox poller introduces publication latency (configurable polling interval)

### Risks

- Soft-deleted data accumulating indefinitely — mitigated by scheduled cleanup jobs for records past retention period
- Outbox table growing under high write throughput — mitigated by immediate deletion after successful publish

## References

- ADR-003: Database Strategy
- ADR-024: Request Context via AsyncLocalStorage (CLS)
- Pattern reference: microservices.io/patterns/data/transactional-outbox
