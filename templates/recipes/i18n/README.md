# Internationalization (i18n)

Multi-language support using nestjs-i18n with automatic language detection.

## Links

- [nestjs-i18n Documentation](https://nestjs-i18n.com/)
- [nestjs-i18n on npm](https://www.npmjs.com/package/nestjs-i18n)

## Dependencies

| Package       | Version  | Purpose                            |
| ------------- | -------- | ---------------------------------- |
| `nestjs-i18n` | `10.5.2` | NestJS internationalization module |

## Usage

Language is resolved automatically from the `lang` query parameter or the `Accept-Language` header. The fallback language is `en`.

```typescript
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class NotificationService {
  constructor(private readonly i18n: I18nService) {}

  getGreeting(): string {
    return this.i18n.t('common.HELLO');
  }
}
```

## Adding a New Language

1. Create a new directory under `src/i18n/` (e.g. `src/i18n/de/`)
2. Add a `common.json` file with the same keys as `en/common.json`
3. The new language is picked up automatically

## Generated Files

| File                             | Description                 |
| -------------------------------- | --------------------------- |
| `src/shared/i18n/i18n.module.ts` | I18n module configuration   |
| `src/i18n/en/common.json`        | English translation strings |
| `src/i18n/nl/common.json`        | Dutch translation strings   |
