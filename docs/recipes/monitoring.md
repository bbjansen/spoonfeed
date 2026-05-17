# Monitoring Recipes

Health checks and metrics collection for NestJS. Keep your application observable and alertable in production.

## Available Recipes

| Recipe        | Purpose                                    | Recipe README                                                             |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Health Checks | Liveness and readiness probes via Terminus | [health-checks](../../packages/templates/recipes/health-checks/README.md) |
| Prometheus    | Metrics collection and exposition          | [prometheus](../../packages/templates/recipes/prometheus/README.md)       |

## Health Checks

Health checks expose endpoints for orchestrators (Kubernetes, ECS, load balancers) to determine if the application is alive and ready to serve traffic.

```typescript
// health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

```typescript
// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  HttpHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private http: HttpHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.http.pingCheck('api', 'https://api.example.com'),
    ]);
  }
}
```

## Prometheus Metrics

Expose a `/metrics` endpoint in Prometheus text format for scraping.

```typescript
// metrics.module.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
})
export class MetricsModule {}
```

### Custom Metrics

```typescript
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

// Register in module
providers: [
  makeCounterProvider({ name: 'http_requests_total', help: 'Total HTTP requests' }),
]

// Inject and use
constructor(@InjectMetric('http_requests_total') private counter: Counter) {}

handleRequest() {
  this.counter.inc({ method: 'GET', path: '/users' });
}
```

## Recommended Setup

| Environment | Health Checks | Prometheus  |
| ----------- | ------------- | ----------- |
| Development | Optional      | Optional    |
| Staging     | Required      | Recommended |
| Production  | Required      | Required    |

## External Documentation

- [NestJS Terminus (Health Checks)](https://docs.nestjs.com/recipes/terminus)
- [@nestjs/terminus](https://www.npmjs.com/package/@nestjs/terminus)
- [@willsoto/nestjs-prometheus](https://www.npmjs.com/package/@willsoto/nestjs-prometheus)
- [Prometheus Documentation](https://prometheus.io/docs)
