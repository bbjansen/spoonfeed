# GitHub OAuth

GitHub OAuth login strategy using Passport for NestJS applications.

## Links

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub Developer Settings](https://github.com/settings/developers)
- [NestJS Authentication Documentation](https://docs.nestjs.com/security/authentication)
- [passport-github2 on npm](https://www.npmjs.com/package/passport-github2)
- [@nestjs/passport on npm](https://www.npmjs.com/package/@nestjs/passport)

## Dependencies

| Package                   | Version  | Purpose                                     |
| ------------------------- | -------- | ------------------------------------------- |
| `passport-github2`        | `0.1.12` | GitHub OAuth 2.0 strategy for Passport      |
| `@nestjs/passport`        | `10.0.3` | Passport integration for NestJS             |
| `passport`                | `0.7.0`  | Authentication middleware                   |
| `@types/passport-github2` | `1.2.9`  | TypeScript definitions for passport-github2 |

## Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers).
2. Click **New OAuth App**.
3. Fill in the application name, homepage URL, and callback URL (e.g. `http://localhost:3000/auth/github/callback`).
4. Click **Register application**.
5. Copy the **Client ID** and generate a **Client Secret** into your environment variables.

## Environment Variables

| Variable               | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `GITHUB_CLIENT_ID`     | OAuth App client ID from GitHub Developer Settings     |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret from GitHub Developer Settings |
| `GITHUB_CALLBACK_URL`  | Callback URL registered in GitHub Developer Settings   |

## Usage

```typescript
@Controller('auth')
export class AuthController {
  @Get('github')
  @UseGuards(GitHubAuthGuard)
  githubLogin() {
    // Redirects to GitHub login page
  }

  @Get('github/callback')
  @UseGuards(GitHubAuthGuard)
  githubCallback(@Request() req) {
    return req.user;
  }
}
```

## Generated Files

| File                                   | Description                                      |
| -------------------------------------- | ------------------------------------------------ |
| `src/shared/auth/github.strategy.ts`   | GitHub OAuth Passport strategy                   |
| `src/shared/auth/github-auth.guard.ts` | Auth guard wrapping the GitHub Passport strategy |
