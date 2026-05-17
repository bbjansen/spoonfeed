# Sign in with Apple

Apple OAuth login strategy using Passport for NestJS applications.

## Links

- [Sign in with Apple Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Apple Developer Portal - Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
- [Configuring Your Environment for Sign in with Apple](https://developer.apple.com/documentation/sign_in_with_apple/configuring_your_environment_for_sign_in_with_apple)
- [NestJS Authentication Documentation](https://docs.nestjs.com/security/authentication)
- [passport-apple on npm](https://www.npmjs.com/package/passport-apple)
- [@nestjs/passport on npm](https://www.npmjs.com/package/@nestjs/passport)

## Dependencies

| Package            | Version  | Purpose                           |
| ------------------ | -------- | --------------------------------- |
| `passport-apple`   | `2.0.2`  | Apple OAuth strategy for Passport |
| `@nestjs/passport` | `10.0.3` | Passport integration for NestJS   |
| `passport`         | `0.7.0`  | Authentication middleware         |

## Setup

1. Go to the [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list).
2. Register an **App ID** with **Sign In with Apple** capability enabled.
3. Register a **Services ID** (this becomes your `APPLE_CLIENT_ID`).
4. Configure the **Web Authentication Configuration** on the Services ID with your domain and callback URL.
5. Create a **Sign In with Apple** private key under **Keys**. Download the `.p8` file.
6. Note your **Team ID** (top-right of the developer portal), the **Key ID**, and the path to the `.p8` file.

## Environment Variables

| Variable                 | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `APPLE_CLIENT_ID`        | Apple Services ID (e.g. `com.example.app`)        |
| `APPLE_TEAM_ID`          | Apple Developer Team ID                           |
| `APPLE_KEY_ID`           | Key ID for the Sign In with Apple private key     |
| `APPLE_PRIVATE_KEY_PATH` | File system path to the `.p8` private key file    |
| `APPLE_CALLBACK_URL`     | Callback URL registered in Apple Developer Portal |

## Usage

```typescript
@Controller('auth')
export class AuthController {
  @Get('apple')
  @UseGuards(AppleAuthGuard)
  appleLogin() {
    // Redirects to Apple login page
  }

  @Post('apple/callback')
  @UseGuards(AppleAuthGuard)
  appleCallback(@Request() req) {
    // Apple sends a POST to the callback URL
    return req.user;
  }
}
```

**Important:** Apple only returns the user's name and email on the **first** authorization. Store this information on the initial login.

## Generated Files

| File                                  | Description                                     |
| ------------------------------------- | ----------------------------------------------- |
| `src/shared/auth/apple.strategy.ts`   | Apple OAuth Passport strategy                   |
| `src/shared/auth/apple-auth.guard.ts` | Auth guard wrapping the Apple Passport strategy |
