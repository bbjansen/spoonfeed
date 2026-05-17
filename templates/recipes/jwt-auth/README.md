# JWT Authentication

JSON Web Token authentication with guards and decorators for NestJS applications.

## Links

- [NestJS Authentication Documentation](https://docs.nestjs.com/security/authentication)
- [@nestjs/jwt on npm](https://www.npmjs.com/package/@nestjs/jwt)
- [@nestjs/jwt on GitHub](https://github.com/nestjs/jwt)
- [@nestjs/passport on npm](https://www.npmjs.com/package/@nestjs/passport)

## Dependencies

| Package               | Version  | Purpose                                 |
| --------------------- | -------- | --------------------------------------- |
| `@nestjs/jwt`         | `10.2.0` | JWT utilities for NestJS                |
| `@nestjs/passport`    | `10.0.3` | Passport integration for NestJS         |
| `passport`            | `0.7.0`  | Authentication middleware               |
| `passport-jwt`        | `4.0.1`  | JWT strategy for Passport               |
| `@types/passport-jwt` | `4.0.1`  | TypeScript definitions for passport-jwt |

## Environment Variables

| Variable         | Default | Description                   |
| ---------------- | ------- | ----------------------------- |
| `JWT_SECRET`     | —       | Secret key for signing tokens |
| `JWT_EXPIRATION` | `3600s` | Token expiration time         |

## Usage

```typescript
// Protect a route with JWT authentication
@Controller('users')
export class UserController {
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return user;
  }

  // Mark a route as publicly accessible
  @Public()
  @Get('public-info')
  getPublicInfo() {
    return { status: 'ok' };
  }
}
```

## Generated Files

| File                                              | Description                                                     |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `src/shared/guards/jwt-auth.guard.ts`             | JWT authentication guard with @Public() support                 |
| `src/shared/decorators/current-user.decorator.ts` | @CurrentUser() parameter decorator to extract user from request |
| `src/shared/decorators/public.decorator.ts`       | @Public() route decorator to bypass JWT guard                   |
