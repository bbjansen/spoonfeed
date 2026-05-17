# Two-Factor Authentication (TOTP)

TOTP-based two-factor authentication with QR code setup and backup codes.

## Links

- [otplib on npm](https://www.npmjs.com/package/otplib)
- [otplib on GitHub](https://github.com/yeojz/otplib)
- [qrcode on npm](https://www.npmjs.com/package/qrcode)
- [RFC 6238 — TOTP Algorithm](https://datatracker.ietf.org/doc/html/rfc6238)
- [RFC 4226 — HOTP Algorithm](https://datatracker.ietf.org/doc/html/rfc4226)

## Dependencies

| Package         | Version  | Purpose                           |
| --------------- | -------- | --------------------------------- |
| `otplib`        | `12.0.1` | TOTP/HOTP token generation        |
| `qrcode`        | `1.5.4`  | QR code generation for OTP URIs   |
| `@types/qrcode` | `1.5.5`  | TypeScript definitions for qrcode |

## Usage

### Setup flow

```typescript
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly totpService: TotpService) {}

  @Post('enable')
  async enable(@CurrentUser() user: User) {
    const secret = this.totpService.generateSecret();
    // Store the secret (encrypted) in the user record
    const qrCode = await this.totpService.generateQrCode(user.email, secret, 'MyApp');
    const backupCodes = this.totpService.generateBackupCodes();
    // Hash and store backup codes
    return { qrCode, backupCodes };
  }

  @Post('verify')
  async verify(@CurrentUser() user: User, @Body('token') token: string) {
    const isValid = this.totpService.verify(token, user.totpSecret);
    if (!isValid) throw new UnauthorizedException('Invalid 2FA token');
    // Mark 2FA as verified for this session
    return { verified: true };
  }
}
```

### QR code setup

1. Call `generateSecret()` and store the secret (encrypted) with the user
2. Call `generateQrCode(email, secret, issuer)` to get a data URI
3. Display the QR code to the user for scanning with an authenticator app
4. Verify a token from the app with `verify(token, secret)` before activating 2FA

### Backup codes

- Generate with `generateBackupCodes()` during 2FA setup
- Display to the user once and instruct them to store securely
- Hash each code (e.g., with bcrypt) before persisting to the database
- Each code is single-use: mark as consumed after successful verification
- Provide a way to regenerate codes (which invalidates old ones)

### Security considerations

- Store TOTP secrets encrypted at rest, not in plain text
- Hash backup codes before persisting (same as passwords)
- Rate-limit verification attempts to prevent brute force
- Consider a time window tolerance (otplib defaults to 1 step = 30 seconds)
- Require re-authentication before enabling or disabling 2FA

## Generated Files

| File                              | Description                                              |
| --------------------------------- | -------------------------------------------------------- |
| `src/shared/auth/totp.service.ts` | TOTP service for secret generation, QR codes, and verify |
