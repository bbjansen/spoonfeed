# Passport Local Authentication

Local (username/password) authentication strategy using Passport for NestJS applications.

## Links

- [NestJS Authentication Documentation](https://docs.nestjs.com/security/authentication)
- [Passport.js Documentation](https://www.passportjs.org)
- [@nestjs/passport on npm](https://www.npmjs.com/package/@nestjs/passport)
- [passport on npm](https://www.npmjs.com/package/passport)
- [passport-local on npm](https://www.npmjs.com/package/passport-local)
- [Passport on GitHub](https://github.com/jaredhanson/passport)

## Dependencies

| Package                 | Version  | Purpose                                   |
| ----------------------- | -------- | ----------------------------------------- |
| `@nestjs/passport`      | `10.0.3` | Passport integration for NestJS           |
| `passport`              | `0.7.0`  | Authentication middleware                 |
| `passport-local`        | `1.0.0`  | Local (username/password) strategy        |
| `@types/passport-local` | `1.0.38` | TypeScript definitions for passport-local |

## Usage

```typescript
// Protect a login route with local strategy
@Controller('auth')
export class AuthController {
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req) {
    return req.user;
  }
}
```

## Generated Files

| File                                    | Description                                                 |
| --------------------------------------- | ----------------------------------------------------------- |
| `src/shared/guards/local-auth.guard.ts` | Local authentication guard wrapping Passport local strategy |
