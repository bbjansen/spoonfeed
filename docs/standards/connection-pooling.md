# Connection Pool Management

## TypeORM (PostgreSQL)

### Basic Configuration with ConfigService

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_NAME'),
    autoLoadEntities: true,
    extra: {
      max: config.get<number>('DB_POOL_MAX', 20),
      min: config.get<number>('DB_POOL_MIN', 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 30_000,
      allowExitOnIdle: false,
    },
  }),
});
```

### Pool Configuration Parameters

| Parameter                 | Description                                 | Default  |
| ------------------------- | ------------------------------------------- | -------- |
| `max`                     | Maximum number of clients in the pool       | 10       |
| `min`                     | Minimum number of idle clients              | 0        |
| `idleTimeoutMillis`       | Close idle clients after this many ms       | 10000    |
| `connectionTimeoutMillis` | Error if connection not acquired within ms  | 0 (none) |
| `statement_timeout`       | Cancel queries that run longer than this ms | none     |
| `allowExitOnIdle`         | Allow process exit when pool is idle        | false    |

### Sizing Guidelines

| Environment | Max Connections | Min Connections | Idle Timeout |
| ----------- | --------------- | --------------- | ------------ |
| Development | 5               | 1               | 10s          |
| Staging     | 10              | 2               | 30s          |
| Production  | 20-50           | 5               | 30s          |

#### Sizing Formula

```
max_connections = (num_cores * 2) + effective_spindle_count
```

For SSDs, `effective_spindle_count` is typically 1. A 4-core server yields:

```
(4 * 2) + 1 = 9 connections per instance
```

When running multiple application instances, divide the database `max_connections` across them:

```
pool_max_per_instance = floor(db_max_connections / num_instances) - reserved_connections
```

Reserve 5-10 connections for admin tooling, monitoring, and migrations.

### Monitoring Queries for PostgreSQL

Check active connections by application:

```sql
SELECT application_name, state, count(*)
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY application_name, state
ORDER BY count DESC;
```

Find long-running queries:

```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
  AND state != 'idle'
ORDER BY duration DESC;
```

Check connections near the limit:

```sql
SELECT max_conn, used, max_conn - used AS available
FROM (SELECT count(*) AS used FROM pg_stat_activity) t1,
     (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') t2;
```

Identify idle connections consuming pool slots:

```sql
SELECT pid, usename, application_name, client_addr, state,
       now() - state_change AS idle_duration
FROM pg_stat_activity
WHERE state = 'idle'
ORDER BY idle_duration DESC;
```

## Redis (ioredis)

### Single Connection

```typescript
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

function createRedisClient(config: ConfigService): Redis {
  return new Redis({
    host: config.getOrThrow<string>('REDIS_HOST'),
    port: config.get<number>('REDIS_PORT', 6379),
    password: config.get<string>('REDIS_PASSWORD'),
    db: config.get<number>('REDIS_DB', 0),
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    lazyConnect: true,
    keepAlive: 30_000,
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    enableReadyCheck: true,
  });
}
```

### Connection Pool with Generic-Pool

ioredis does not include a built-in pool. For high-throughput scenarios, use `generic-pool`:

```typescript
import { createPool, Pool } from 'generic-pool';
import Redis from 'ioredis';

function createRedisPool(config: ConfigService): Pool<Redis> {
  return createPool(
    {
      create: async () => {
        const client = new Redis({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT', 6379),
          lazyConnect: true,
        });
        await client.connect();
        return client;
      },
      destroy: async (client) => {
        await client.quit();
      },
      validate: async (client) => {
        try {
          await client.ping();
          return true;
        } catch {
          return false;
        }
      },
    },
    {
      min: 2,
      max: 10,
      testOnBorrow: true,
      acquireTimeoutMillis: 3_000,
      idleTimeoutMillis: 30_000,
    },
  );
}
```

### Redis Pool Sizing

| Environment | Max Connections | Min Connections |
| ----------- | --------------- | --------------- |
| Development | 2               | 1               |
| Staging     | 5               | 2               |
| Production  | 10-20           | 3               |

## HTTP Client (Outbound Requests)

### Node.js HTTP Agent

```typescript
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';

const httpAgent = new HttpAgent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30_000,
  scheduling: 'lifo',
});

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30_000,
  scheduling: 'lifo',
});
```

### Integration with NestJS HttpModule

```typescript
import { HttpModule } from '@nestjs/axios';
import { Agent } from 'node:https';

HttpModule.register({
  timeout: 10_000,
  maxRedirects: 3,
  httpsAgent: new Agent({
    keepAlive: true,
    maxSockets: 25,
    maxFreeSockets: 5,
  }),
});
```

### HTTP Agent Parameters

| Parameter        | Description                                  | Recommended |
| ---------------- | -------------------------------------------- | ----------- |
| `keepAlive`      | Reuse TCP connections across requests        | `true`      |
| `maxSockets`     | Max concurrent sockets per host              | 25-50       |
| `maxFreeSockets` | Max idle sockets to keep open                | 5-10        |
| `timeout`        | Socket inactivity timeout in ms              | 30000       |
| `scheduling`     | `lifo` reuses recent sockets, `fifo` rotates | `lifo`      |

## Common Mistakes

1. **No connection timeout** -- queries hang indefinitely when the database is unreachable.
2. **Pool too large** -- each connection consumes ~10 MB of database memory. Oversized pools waste resources and can hit `max_connections`.
3. **No idle timeout** -- stale connections accumulate and are never reclaimed.
4. **Missing health checks** -- the pool hands out dead connections after a network disruption.
5. **Ignoring per-instance math** -- setting `max: 50` on 10 pods means 500 connections at the database.
