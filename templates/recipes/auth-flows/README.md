# Auth Flows

Complete signup, email verification, and password reset flows for NestJS applications.

## Links

- [NestJS Authentication Documentation](https://docs.nestjs.com/security/authentication)
- [bcrypt on npm](https://www.npmjs.com/package/bcrypt)
- [bcrypt on GitHub](https://github.com/kelektiv/node.bcrypt.js)
- [uuid on npm](https://www.npmjs.com/package/uuid)

## Dependencies

| Package         | Version  | Purpose                           |
| --------------- | -------- | --------------------------------- |
| `bcrypt`        | `6.0.0`  | Password hashing                  |
| `uuid`          | `11.1.0` | Unique token generation           |
| `@types/bcrypt` | `5.0.2`  | TypeScript definitions for bcrypt |

## Environment Variables

| Variable                      | Default                                | Description                           |
| ----------------------------- | -------------------------------------- | ------------------------------------- |
| `AUTH_JWT_SECRET`             | `change-me-in-production`              | JWT secret for auth flow tokens       |
| `AUTH_EMAIL_VERIFICATION_URL` | `http://localhost:3000/verify-email`   | Base URL for email verification links |
| `AUTH_PASSWORD_RESET_URL`     | `http://localhost:3000/reset-password` | Base URL for password reset links     |

## Requires

- **jwt-auth** -- this recipe depends on `@nestjs/jwt` being available.

## Usage Flow

```
1. Signup
   POST /auth/signup  { email, password, name }
       |
       v
   User created (emailVerified = false)
   Verification email sent with token
       |
       v
2. Verify Email
   POST /auth/verify-email?token=<token>
       |
       v
   emailVerified = true

3. Login
   POST /auth/login  { email, password }
       |
       v
   Returns { accessToken }

4. Forgot Password
   POST /auth/forgot-password  { email }
       |
       v
   Reset email sent with token (if user exists)
       |
       v
5. Reset Password
   POST /auth/reset-password  { token, newPassword }
       |
       v
   Password updated, reset token cleared
```

## Wiring Into Production

The generated `AuthFlowService` uses an in-memory user store and logs emails
to the console. Before deploying you must:

1. **Replace the in-memory store** -- inject your `UserRepository` (TypeORM,
   Prisma, Mongoose, etc.) and persist users to a real database.
2. **Inject an email service** -- replace `sendVerificationEmail` and
   `sendPasswordResetEmail` with calls to Nodemailer, SendGrid, SES, or
   whichever transport your project uses.
3. **Register `AuthFlowModule`** in your root `AppModule` imports.

## Generated Files

| File                                              | Description                                     |
| ------------------------------------------------- | ----------------------------------------------- |
| `src/app/modules/auth/auth.module.ts`             | Auth flow module                                |
| `src/app/modules/auth/auth.service.ts`            | Service with signup, login, verify, reset logic |
| `src/app/modules/auth/auth.controller.ts`         | REST endpoints for all auth flows               |
| `src/app/modules/auth/dto/signup.dto.ts`          | Signup request validation                       |
| `src/app/modules/auth/dto/login.dto.ts`           | Login request validation                        |
| `src/app/modules/auth/dto/forgot-password.dto.ts` | Forgot-password request validation              |
| `src/app/modules/auth/dto/reset-password.dto.ts`  | Reset-password request validation               |
