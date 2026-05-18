# Database Recipes

spoonfeed provides 10 database-related recipes covering relational ORMs, document databases, and data lifecycle patterns. Choose a primary ORM/ODM recipe for your project, then layer on optional recipes like soft-delete, audit-trail, or transactional-outbox to handle cross-cutting data concerns.

!!! note "Mutual exclusivity"
    The primary ORM/ODM recipes (`typeorm-postgres`, `typeorm-mysql`, `prisma`, `mongoose`, `drizzle-postgres`, `kysely`, `mikro-orm`) conflict with each other. Select one per project.

!!! tip "Recommended combinations"
    - **Full data lifecycle:** `typeorm-postgres` + `database-seeding` + `database-factories` + `soft-delete`
    - **Event-driven systems:** any ORM recipe + `transactional-outbox` + `rabbitmq` or `bullmq`
    - **Compliance-heavy apps:** any ORM recipe + `audit-trail` + `data-masking`

---

## TypeORM + PostgreSQL

TypeORM integration with the PostgreSQL driver. Uses the repository pattern with decorators.

| | |
| --- | --- |
| **ID** | `typeorm-postgres` |
| **Category** | Database |
| **Dependencies** | `@nestjs/typeorm` `typeorm` `pg` |
| **Conflicts** | `typeorm-mysql`, `prisma`, `mongoose`, `drizzle-postgres`, `kysely`, `mikro-orm` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_NAME` | `app` | PostgreSQL database name |

**Usage:** Entities live in `src/<module>/entities/`. Inject repositories with `@InjectRepository()`. Use migrations for schema changes — never `synchronize: true` in production.

```typescript
// src/users/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;
}

// src/users/user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }
}
```

!!! warning "Requires a running PostgreSQL instance"
    Ensure PostgreSQL is running locally or via Docker before starting the app. The `docker-compose-dev` recipe provides a pre-configured setup.

**Pairs well with:** `database-seeding`, `database-factories`, `soft-delete`, `audit-trail`

---

## TypeORM + MySQL

TypeORM integration with the MySQL driver.

| | |
| --- | --- |
| **ID** | `typeorm-mysql` |
| **Category** | Database |
| **Dependencies** | `@nestjs/typeorm` `typeorm` `mysql2` |
| **Conflicts** | `typeorm-postgres`, `prisma`, `mongoose`, `drizzle-postgres`, `kysely`, `mikro-orm` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USERNAME` | `root` | MySQL username |
| `DB_PASSWORD` | `root` | MySQL password |
| `DB_NAME` | `app` | MySQL database name |

**Usage:** Same repository pattern as TypeORM + PostgreSQL. Run migrations with `pnpm typeorm migration:run`.

!!! warning "Requires a running MySQL instance"
    Ensure MySQL is running locally or via Docker before starting the app.

---

## Prisma

Schema-first ORM with a type-safe client generated from `prisma/schema.prisma`.

| | |
| --- | --- |
| **ID** | `prisma` |
| **Category** | Database |
| **Dependencies** | `@prisma/client` |
| **Dev dependencies** | `prisma` |
| **Conflicts** | `typeorm-postgres`, `typeorm-mysql`, `mongoose`, `drizzle-postgres`, `kysely`, `mikro-orm` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/app` | Prisma database connection URL |

**Usage:** Edit `prisma/schema.prisma`, then run `pnpm prisma generate` and `pnpm prisma migrate dev`. Inject `PrismaService` for database access.

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

**Pairs well with:** `database-seeding`, `database-factories`

---

## Mongoose

MongoDB integration with the Mongoose ODM. Uses decorators for schema definitions.

| | |
| --- | --- |
| **ID** | `mongoose` |
| **Category** | Database |
| **Dependencies** | `@nestjs/mongoose` `mongoose` |
| **Conflicts** | `typeorm-postgres`, `typeorm-mysql`, `prisma`, `drizzle-postgres`, `kysely`, `mikro-orm` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://localhost:27017/app` | MongoDB connection URI |

**Usage:** Define schemas with `@Schema()` and `@Prop()` decorators. Inject models with `@InjectModel()`. Use `lean()` for read-only queries.

!!! warning "Requires a running MongoDB instance"
    Ensure MongoDB is running locally or via Docker before starting the app.

**Pairs well with:** `database-seeding`, `database-factories`

---

## Drizzle ORM + PostgreSQL

Lightweight type-safe ORM with best-in-class performance. SQL-first approach with TypeScript schema definitions.

| | |
| --- | --- |
| **ID** | `drizzle-postgres` |
| **Category** | Database |
| **Dependencies** | `drizzle-orm` `pg` |
| **Dev dependencies** | `drizzle-kit` |
| **Conflicts** | `typeorm-postgres`, `typeorm-mysql`, `prisma`, `mongoose`, `kysely`, `mikro-orm` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/app` | PostgreSQL connection URL |

**Usage:** Schema definitions live in `src/infrastructure/database/schema/`. Run `pnpm drizzle:generate` after changes, then `pnpm drizzle:migrate`.

---

## Kysely

Type-safe SQL query builder with zero overhead. You write the SQL; Kysely provides type safety.

| | |
| --- | --- |
| **ID** | `kysely` |
| **Category** | Database |
| **Dependencies** | `kysely` `pg` |
| **Dev dependencies** | `kysely-ctl` |
| **Conflicts** | `typeorm-postgres`, `typeorm-mysql`, `prisma`, `mongoose`, `drizzle-postgres`, `mikro-orm` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/app` | PostgreSQL connection URL |

**Usage:** Define database types in `src/infrastructure/database/types.ts`. Use `db.selectFrom()`, `db.insertInto()`, etc. Migrations via `kysely-ctl`.

---

## MikroORM + PostgreSQL

Data Mapper ORM with Unit of Work and Identity Map, well-suited for Domain-Driven Design.

| | |
| --- | --- |
| **ID** | `mikro-orm` |
| **Category** | Database |
| **Dependencies** | `@mikro-orm/core` `@mikro-orm/nestjs` `@mikro-orm/postgresql` `@mikro-orm/migrations` |
| **Dev dependencies** | `@mikro-orm/cli` |
| **Conflicts** | `typeorm-postgres`, `typeorm-mysql`, `prisma`, `mongoose`, `drizzle-postgres`, `kysely` |
| **Compatible with** | All project types |

**Environment variables:**

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `app` | PostgreSQL database name |
| `DB_USERNAME` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |

**Usage:** Entities in `src/infrastructure/database/entities/`. Changes persist on `em.flush()`. Migrations via `pnpm mikro-orm migration:create`.

---

## Soft Delete

Mark records as deleted instead of removing them. Adds a `deletedAt` column to entities.

| | |
| --- | --- |
| **ID** | `soft-delete` |
| **Category** | Database |
| **Dependencies** | `@nestjs/typeorm` `typeorm` |
| **Compatible with** | All project types |

**Usage:** Extend `SoftDeletableEntity` for entities that should be soft-deleted. Use `repository.softRemove()` instead of `remove()`. Query soft-deleted records with `@WithDeleted()`.

---

## Audit Trail

Record entity changes with user, action, and diff. Captures who changed what and when.

| | |
| --- | --- |
| **ID** | `audit-trail` |
| **Category** | Database |
| **Compatible with** | All project types |

**Usage:** Apply `AuditInterceptor` globally or per-controller. Use `@Auditable()` decorator to mark handlers. Entries capture userId, action, entityName, entityId, changes, timestamp, and IP.

---

## Transactional Outbox

Guarantee at-least-once event delivery alongside database writes using the outbox pattern.

| | |
| --- | --- |
| **ID** | `transactional-outbox` |
| **Category** | Database |
| **Dependencies** | `@nestjs/typeorm` `typeorm` |
| **Compatible with** | HTTP API, Microservice, Scheduled Worker, Full-Stack, Monorepo |

**Usage:** Call `OutboxService.addMessage()` within a transaction. Events are written to the `outbox` table atomically alongside business data, then published by a polling publisher.

!!! note
    The outbox pattern guarantees at-least-once delivery. Consumers must be idempotent. Consider pairing with the `idempotency` recipe for downstream services.

**Pairs well with:** `rabbitmq`, `bullmq`, `aws-sqs`
