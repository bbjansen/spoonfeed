# GCP Firebase Auth

Firebase Authentication for user identity management in NestJS.

## Documentation

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [firebase-admin on npm](https://www.npmjs.com/package/firebase-admin)
- [NestJS Authentication](https://docs.nestjs.com/security/authentication)

## Dependencies

| Package          | Version  | Purpose            |
| ---------------- | -------- | ------------------ |
| `firebase-admin` | `13.0.2` | Firebase Admin SDK |

## Environment Variables

| Variable                         | Default | Description                      |
| -------------------------------- | ------- | -------------------------------- |
| `GCP_PROJECT_ID`                 | —       | GCP/Firebase project ID          |
| `GOOGLE_APPLICATION_CREDENTIALS` | —       | Path to service account key JSON |

## Usage

```typescript
import { FirebaseAuthGuard } from '@/gcp/firebase-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('profile')
@UseGuards(FirebaseAuthGuard)
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: FirebaseUser) {
    return this.profileService.findByUid(user.uid);
  }
}
```
