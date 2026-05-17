# Data Pattern Recipes

Patterns for handling data lifecycle, compliance, and reliable event delivery alongside database writes.

## Available Recipes

| Recipe               | Pattern                                 | Best For                                             | Recipe README                                                                           |
| -------------------- | --------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Soft Delete          | Logical deletion via `deletedAt` column | Undo support, audit requirements, referential safety | [soft-delete](../../packages/templates/recipes/soft-delete/README.md)                   |
| Audit Trail          | Change log with user, action, and diff  | Compliance (SOX, GDPR), debugging, history tracking  | [audit-trail](../../packages/templates/recipes/audit-trail/README.md)                   |
| Transactional Outbox | Outbox table written in the same DB txn | Guaranteed event delivery without 2PC                | [transactional-outbox](../../packages/templates/recipes/transactional-outbox/README.md) |

## When to Use Each

- **Soft Delete** — when users or admins need to recover deleted records, or when foreign-key relationships make hard deletes dangerous.
- **Audit Trail** — when regulations or business rules require a complete history of who changed what and when.
- **Transactional Outbox** — when you publish domain events (e.g. to RabbitMQ or Kafka) and need to guarantee delivery even if the message broker is temporarily down.

## Comparison

| Feature                 | Soft Delete         | Audit Trail          | Transactional Outbox     |
| ----------------------- | ------------------- | -------------------- | ------------------------ |
| Primary concern         | Data recovery       | Change tracking      | Reliable event delivery  |
| Extra DB columns/tables | `deletedAt` column  | Separate audit table | `outbox_events` table    |
| Performance impact      | Minimal (index)     | Write per change     | Write per event + poller |
| Query complexity        | Filtered by default | Join for history     | Background polling       |
| Typical regulation      | Data retention      | SOX, GDPR, HIPAA     | Event-driven consistency |

## Quick Start: Soft Delete

```typescript
import { Entity, Column, DeleteDateColumn } from 'typeorm';

@Entity()
export class Article {
  @Column()
  title: string;

  @DeleteDateColumn()
  deletedAt?: Date;
}

// Soft-delete: sets deletedAt, excluded from normal queries
await repository.softRemove(article);

// Restore
await repository.recover(article);

// Include soft-deleted records
await repository.find({ withDeleted: true });
```

## External Documentation

- [TypeORM Soft Delete](https://typeorm.io/delete-query-builder#soft-delete)
- [Microservices Patterns — Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)
