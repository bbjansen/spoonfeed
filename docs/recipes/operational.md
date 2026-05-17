# Operational Recipes

Production-readiness patterns for NestJS: graceful shutdown, resilience, feature management, and tenant isolation.

## Available Recipes

| Recipe            | Purpose                                                             | Recipe README                                                                     |
| ----------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Graceful Shutdown | Drain connections and finish in-flight requests before exit         | [graceful-shutdown](../../packages/templates/recipes/graceful-shutdown/README.md) |
| Circuit Breaker   | Prevent cascading failures when downstream services are unavailable | [circuit-breaker](../../packages/templates/recipes/circuit-breaker/README.md)     |
| Feature Flags     | Toggle features at runtime without redeployment                     | [feature-flags](../../packages/templates/recipes/feature-flags/README.md)         |
| Multi-Tenancy     | Isolate data and configuration per tenant                           | [multi-tenancy](../../packages/templates/recipes/multi-tenancy/README.md)         |

## Graceful Shutdown

NestJS provides lifecycle hooks for clean shutdown. Enable `shutdownHooks` and implement `OnApplicationShutdown`.

```typescript
// main.ts
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(3000);
```

```typescript
// database.service.ts
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  async onApplicationShutdown(signal: string) {
    await this.connection.close();
    console.log(`Database connection closed (signal: ${signal})`);
  }
}
```

## Circuit Breaker

Wrap external calls with a circuit breaker to fail fast when a dependency is down.

```typescript
import CircuitBreaker from 'opossum';

@Injectable()
export class PaymentService {
  private breaker: CircuitBreaker;

  constructor(private readonly http: HttpService) {
    this.breaker = new CircuitBreaker(
      (data: PaymentRequest) => this.http.axiosRef.post('/charge', data),
      {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      },
    );
  }

  async charge(data: PaymentRequest) {
    return this.breaker.fire(data);
  }
}
```

## Feature Flags

```typescript
@Injectable()
export class FeatureFlagService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(flag: string): boolean {
    return this.configService.get<boolean>(`features.${flag}`, false);
  }
}
```

```typescript
// usage in controller
@Get('dashboard')
getDashboard() {
  if (this.featureFlags.isEnabled('newDashboard')) {
    return this.newDashboard();
  }
  return this.legacyDashboard();
}
```

## Multi-Tenancy Strategies

| Strategy              | Isolation | Complexity | Use When                      |
| --------------------- | --------- | ---------- | ----------------------------- |
| Row-level (shared DB) | Low       | Low        | Small tenants, cost-sensitive |
| Schema-per-tenant     | Medium    | Medium     | Moderate isolation needs      |
| Database-per-tenant   | High      | High       | Compliance, large tenants     |

```typescript
// tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Missing tenant ID');
    req['tenantId'] = tenantId;
    next();
  }
}
```

## External Documentation

- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [opossum (Circuit Breaker)](https://www.npmjs.com/package/opossum)
- [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)
