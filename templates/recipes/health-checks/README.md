# Health Checks

Application health monitoring using Terminus for NestJS applications.

## Links

- [NestJS Terminus Recipe](https://docs.nestjs.com/recipes/terminus)
- [@nestjs/terminus on npm](https://www.npmjs.com/package/@nestjs/terminus)
- [@nestjs/terminus on GitHub](https://github.com/nestjs/terminus)

## Dependencies

| Package            | Version  | Purpose                           |
| ------------------ | -------- | --------------------------------- |
| `@nestjs/terminus` | `10.2.3` | Health check utilities for NestJS |

## Usage

```typescript
import { HealthModule } from '@/shared/health/health.module';

@Module({
  imports: [HealthModule],
})
export class AppModule {}

// Access health checks at GET /health
```

## Generated Files

| File                                     | Description                                             |
| ---------------------------------------- | ------------------------------------------------------- |
| `src/shared/health/health.module.ts`     | HealthModule registering the health controller          |
| `src/shared/health/health.controller.ts` | Health check controller with disk and memory indicators |
