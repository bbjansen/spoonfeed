# Google OAuth 2.0

Google OAuth 2.0 login strategy using Passport for NestJS applications.

## Links

- [Google Identity: OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
- [NestJS Authentication Documentation](https://docs.nestjs.com/security/authentication)
- [passport-google-oauth20 on npm](https://www.npmjs.com/package/passport-google-oauth20)
- [@nestjs/passport on npm](https://www.npmjs.com/package/@nestjs/passport)

## Dependencies

| Package                          | Version  | Purpose                                            |
| -------------------------------- | -------- | -------------------------------------------------- |
| `passport-google-oauth20`        | `2.0.0`  | Google OAuth 2.0 strategy for Passport             |
| `@nestjs/passport`               | `10.0.3` | Passport integration for NestJS                    |
| `passport`                       | `0.7.0`  | Authentication middleware                          |
| `@types/passport-google-oauth20` | `2.0.16` | TypeScript definitions for passport-google-oauth20 |

## Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth client ID**.
5. Select **Web application** as the application type.
6. Add your callback URL (e.g. `http://localhost:3000/auth/google/callback`) under **Authorized redirect URIs**.
7. Copy the **Client ID** and **Client Secret** into your environment variables.

## Environment Variables

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth 2.0 client ID from Google Cloud Console     |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret from Google Cloud Console |
| `GOOGLE_CALLBACK_URL`  | Callback URL registered in Google Cloud Console   |

## Usage

```typescript
@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Redirects to Google login page
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Request() req) {
    return req.user;
  }
}
```

## Generated Files

| File                                   | Description                                      |
| -------------------------------------- | ------------------------------------------------ |
| `src/shared/auth/google.strategy.ts`   | Google OAuth 2.0 Passport strategy               |
| `src/shared/auth/google-auth.guard.ts` | Auth guard wrapping the Google Passport strategy |
