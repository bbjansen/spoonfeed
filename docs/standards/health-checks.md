# Health Check Standards

## Probe Types

| Probe         | Path              | Purpose                       | What to Check                                             |
| ------------- | ----------------- | ----------------------------- | --------------------------------------------------------- |
| **Liveness**  | `/health/live`    | Is the process alive?         | Always returns 200 if the process is running              |
| **Readiness** | `/health/ready`   | Can it accept requests?       | Database connection, Redis, external dependencies         |
| **Startup**   | `/health/startup` | Has it finished initializing? | One-time initialization checks (migrations, cache warmup) |

### When to Use Each Probe

- **Liveness** -- Keep this check trivial. If it fails, Kubernetes kills and restarts the pod. Never include dependency checks here; a down database should not cause a restart loop.
- **Readiness** -- Include all dependencies the service needs to handle requests. When this fails, the pod is removed from the Service endpoints (no traffic) but stays running. Use this to shed load during transient dependency outages.
- **Startup** -- Use for services with slow initialization (running migrations, warming caches, loading ML models). Kubernetes will not run liveness or readiness probes until the startup probe succeeds.

## Kubernetes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
  successThreshold: 1

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
  successThreshold: 1

startupProbe:
  httpGet:
    path: /health/startup
    port: 3000
  failureThreshold: 30
  periodSeconds: 10
  timeoutSeconds: 5
```

### Probe Tuning Guidelines

| Parameter             | Liveness | Readiness | Startup |
| --------------------- | -------- | --------- | ------- |
| `initialDelaySeconds` | 15       | 5         | 0       |
| `periodSeconds`       | 10       | 5         | 10      |
| `timeoutSeconds`      | 3        | 3         | 5       |
| `failureThreshold`    | 3        | 3         | 30      |
| `successThreshold`    | 1        | 1         | 1       |

The startup probe allows up to `failureThreshold * periodSeconds` = 300 seconds for the application to initialize before Kubernetes considers it failed.

## Implementation with @nestjs/terminus

### HealthModule

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
```

### HealthController

```typescript
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly http: HttpHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  checkLive() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  checkReady() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.redis.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 512 * 1024 * 1024),
      () =>
        this.disk.checkStorage('disk', {
          thresholdPercent: 0.9,
          path: '/',
        }),
    ]);
  }

  @Get('startup')
  @HealthCheck()
  checkStartup() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 5000 }),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
```

### Custom Redis Health Indicator

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@InjectRedis() private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const latencyStart = Date.now();
      await this.redis.ping();
      const latency = Date.now() - latencyStart;

      return this.getStatus(key, true, { latency_ms: latency });
    } catch (error) {
      throw new HealthCheckError(
        `${key} health check failed`,
        this.getStatus(key, false, { message: (error as Error).message }),
      );
    }
  }
}
```

### Custom External Service Health Indicator

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

@Injectable()
export class ExternalApiHealthIndicator extends HealthIndicator {
  constructor(private readonly http: HttpService) {
    super();
  }

  async isHealthy(key: string, url: string): Promise<HealthIndicatorResult> {
    try {
      const start = Date.now();
      await firstValueFrom(
        this.http.get(url).pipe(
          timeout(3000),
          catchError((err) => {
            throw new Error(`Upstream returned ${err.response?.status ?? 'no response'}`);
          }),
        ),
      );
      return this.getStatus(key, true, { latency_ms: Date.now() - start });
    } catch (error) {
      throw new HealthCheckError(
        `${key} is not available`,
        this.getStatus(key, false, { message: (error as Error).message }),
      );
    }
  }
}
```

## Health Response Format

### Healthy (HTTP 200)

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up", "latency_ms": 2 },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" },
    "disk": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up", "latency_ms": 2 },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" },
    "disk": { "status": "up" }
  }
}
```

### Unhealthy (HTTP 503)

```json
{
  "status": "error",
  "info": {
    "memory_heap": { "status": "up" },
    "disk": { "status": "up" }
  },
  "error": {
    "database": {
      "status": "down",
      "message": "Connection refused"
    },
    "redis": {
      "status": "down",
      "message": "ECONNREFUSED 127.0.0.1:6379"
    }
  },
  "details": {
    "database": { "status": "down", "message": "Connection refused" },
    "redis": { "status": "down", "message": "ECONNREFUSED 127.0.0.1:6379" },
    "memory_heap": { "status": "up" },
    "disk": { "status": "up" }
  }
}
```

## Degraded State Handling

The default @nestjs/terminus behavior is binary: either all checks pass (200) or any failure returns 503. For services that can operate in a degraded mode, implement a custom response:

```typescript
@Get('ready')
@HealthCheck()
async checkReady() {
  const result = await this.health.check([
    () => this.db.pingCheck('database', { timeout: 3000 }),
    () => this.redis.isHealthy('redis'),
    () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
  ]);

  return result;
}

@Get('detailed')
async checkDetailed(): Promise<DetailedHealthResponse> {
  const checks = await Promise.allSettled([
    this.db.pingCheck('database', { timeout: 3000 }),
    this.redis.isHealthy('redis'),
    this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
  ]);

  const critical = checks[0].status === 'fulfilled'; // database
  const nonCritical = checks[1].status === 'fulfilled'; // redis

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (critical && nonCritical) {
    status = 'healthy';
  } else if (critical) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      redis: checks[1].status === 'fulfilled' ? 'up' : 'down',
      memory: checks[2].status === 'fulfilled' ? 'up' : 'down',
    },
  };
}
```

## Security Considerations

- Do not expose detailed health information publicly. Restrict `/health/detailed` to internal networks or authenticated callers.
- The liveness and readiness endpoints should return minimal information (status only).
- Never include database connection strings, credentials, or version numbers in health responses.
- Consider rate-limiting health endpoints if they are publicly accessible.
