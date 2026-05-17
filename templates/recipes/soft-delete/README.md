# Soft Delete

Mark records as deleted instead of removing them from the database.

## Links

- [TypeORM @DeleteDateColumn](https://typeorm.io/decorator-reference#deletedatecolumn)
- [TypeORM Soft Delete](https://typeorm.io/delete-query-builder#soft-delete)

## Dependencies

None — uses TypeORM decorators (already included with a TypeORM recipe) or can be adapted for Prisma.

## Usage

### TypeORM

Extend `SoftDeletableEntity` to add soft-delete support to any entity:

```typescript
import { Entity, Column } from 'typeorm';
import { SoftDeletableEntity } from '@/shared/entities/soft-deletable.entity';

@Entity()
export class User extends SoftDeletableEntity {
  @Column()
  name: string;
}
```

Use `softRemove()` or `softDelete()` instead of `remove()` or `delete()`:

```typescript
await this.userRepository.softRemove(user);
await this.userRepository.softDelete(user.id);
```

Recover a soft-deleted record:

```typescript
await this.userRepository.recover(user);
```

Query including soft-deleted records:

```typescript
const users = await this.userRepository.find({ withDeleted: true });
```

Use the `@WithDeleted()` decorator to set metadata for interceptors or guards that need to include deleted records.

### Prisma Alternative

For Prisma, implement soft delete via middleware:

```typescript
prisma.$use(async (params, next) => {
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  }
  return next(params);
});
```

## Generated Files

| File                                              | Description                                      |
| ------------------------------------------------- | ------------------------------------------------ |
| `src/shared/entities/soft-deletable.entity.ts`    | Abstract base entity with soft-delete columns    |
| `src/shared/decorators/with-deleted.decorator.ts` | Metadata decorator for including deleted records |
