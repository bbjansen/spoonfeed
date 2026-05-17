# Prometheus Metrics

Application metrics collection and exposition using prom-client for NestJS applications.

## Links

- [prom-client on npm](https://www.npmjs.com/package/prom-client)
- [prom-client on GitHub](https://github.com/siimon/prom-client)
- [Prometheus Documentation](https://prometheus.io/docs/)

## Dependencies

| Package       | Version  | Purpose                               |
| ------------- | -------- | ------------------------------------- |
| `prom-client` | `15.1.3` | Prometheus client library for Node.js |

## Environment Variables

| Variable         | Default | Description                          |
| ---------------- | ------- | ------------------------------------ |
| `METRICS_PREFIX` | —       | Optional prefix for all metric names |

## Usage

```typescript
import { MetricsModule } from '@/infrastructure/metrics/metrics.module';

@Module({
  imports: [MetricsModule],
})
export class AppModule {}

// Access metrics at GET /metrics
// Inject the Registry to create custom metrics:
@Injectable()
export class OrderService {
  private readonly orderCounter: Counter;

  constructor(@Inject('PROM_REGISTRY') private registry: Registry) {
    this.orderCounter = new Counter({
      name: 'orders_total',
      help: 'Total number of orders',
      registers: [registry],
    });
  }
}
```

## Generated Files

| File                                               | Description                                               |
| -------------------------------------------------- | --------------------------------------------------------- |
| `src/infrastructure/metrics/metrics.module.ts`     | Prometheus metrics module with default metrics collection |
| `src/infrastructure/metrics/metrics.controller.ts` | Controller exposing `/metrics` endpoint                   |
