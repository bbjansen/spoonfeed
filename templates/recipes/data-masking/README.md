# Data Masking / PII Redaction

Automatic PII redaction in logs and API responses for GDPR/CCPA compliance.

## Links

- [GDPR Article 25 — Data Protection by Design](https://gdpr-info.eu/art-25-gdpr/)
- [CCPA — California Consumer Privacy Act](https://oag.ca.gov/privacy/ccpa)
- [class-transformer on npm](https://www.npmjs.com/package/class-transformer)

## Dependencies

No additional dependencies. Uses `class-transformer` which is already included in the base template.

## Usage

### DTO Masking with @Sensitive()

Apply the `@Sensitive()` decorator to DTO properties that contain PII. Masking is applied automatically when serializing to plain objects via `class-transformer` (`toPlainOnly: true`).

```typescript
import { Sensitive } from '@/shared/decorators/sensitive.decorator';
import { Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  @Sensitive('*', 4) // last 4 characters visible
  email: string;

  @Expose()
  @Sensitive('*', 4)
  phone: string;
}
```

Response output:

```json
{
  "id": "abc-123",
  "name": "Jane Doe",
  "email": "***********e.com",
  "phone": "********1234"
}
```

### Log Redaction with Mask Utilities

Use the mask utility functions to redact PII before writing to logs:

```typescript
import { maskEmail, maskPhone, maskCreditCard, maskIban } from '@/shared/utils/mask.util';

logger.log(`Processing payment for ${maskEmail('jane@example.com')}`);
// => Processing payment for j**e@example.com

logger.log(`Card: ${maskCreditCard('4111 1111 1111 1234')}`);
// => Card: ************1234

logger.log(`IBAN: ${maskIban('NL91ABNA0417164300')}`);
// => IBAN: NL91**********4300

logger.log(`Phone: ${maskPhone('+31 6 1234 5678')}`);
// => Phone: ******5678
```

### GDPR/CCPA Compliance Patterns

1. **Response masking** — Apply `@Sensitive()` to all DTO fields containing PII (email, phone, SSN, etc.)
2. **Log redaction** — Use mask utilities before logging any PII. Never log raw personal data.
3. **Database queries** — Mask PII when returning data in admin/reporting contexts where full values are not needed.
4. **Audit trails** — Store masked versions of PII in audit logs to maintain traceability without exposing raw data.

## Generated Files

| File                                           | Description                                            |
| ---------------------------------------------- | ------------------------------------------------------ |
| `src/shared/decorators/sensitive.decorator.ts` | @Sensitive() property decorator for DTO field masking  |
| `src/shared/utils/mask.util.ts`                | Utility functions for masking email, phone, card, IBAN |
