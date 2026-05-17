# Feature Flags

Config-based feature flag service for toggling features at runtime.

## Links

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)

## Dependencies

No additional dependencies required. Uses the built-in NestJS ConfigService.

| Package | Version | Purpose                   |
| ------- | ------- | ------------------------- |
| (none)  | -       | Built-in `@nestjs/config` |

## Environment Variables

Feature flags are defined as environment variables with the `FF_` prefix:

| Variable           | Description               | Example |
| ------------------ | ------------------------- | ------- |
| `FF_NEW_DASHBOARD` | Enable new dashboard UI   | `true`  |
| `FF_BETA_API`      | Enable beta API endpoints | `false` |

## Usage

```typescript
import { FeatureFlagService } from '@/shared/services/feature-flag.service';

constructor(private readonly flags: FeatureFlagService) {}

if (this.flags.isEnabled('NEW_DASHBOARD')) {
  // new dashboard logic
}

// With default value
const limit = this.flags.getValue('RATE_LIMIT', '100');
```

## Generated Files

| File                                          | Description                       |
| --------------------------------------------- | --------------------------------- |
| `src/shared/services/feature-flag.service.ts` | Config-based feature flag service |
