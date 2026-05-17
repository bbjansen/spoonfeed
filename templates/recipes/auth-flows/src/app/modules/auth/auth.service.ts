import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Scaffold user record. Replace with your own User entity / repository.
 */
interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
}

const BCRYPT_SALT_ROUNDS = 12;

/**
 * AuthFlowService provides complete signup, login, email-verification,
 * and password-reset flows.
 *
 * **Before going to production** you must:
 * 1. Replace the in-memory `users` map with a real UserRepository.
 * 2. Inject a mail / notification service and send real emails in
 *    `sendVerificationEmail` and `sendPasswordResetEmail`.
 */
@Injectable()
export class AuthFlowService {
  private readonly logger = new Logger(AuthFlowService.name);

  /**
   * In-memory store -- replace with your database repository.
   */
  private readonly users = new Map<string, UserRecord>();

  constructor(private readonly jwtService: JwtService) {}

  /* ------------------------------------------------------------------ */
  /*  Signup                                                             */
  /* ------------------------------------------------------------------ */

  async signup(dto: SignupDto): Promise<{ id: string; email: string }> {
    const existing = this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const verificationToken = uuidv4();

    const user: UserRecord = {
      id: uuidv4(),
      email: dto.email.toLowerCase().trim(),
      name: dto.name,
      passwordHash,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      passwordResetToken: null,
      passwordResetExpires: null,
    };

    this.users.set(user.id, user);

    await this.sendVerificationEmail(user.email, verificationToken);

    return { id: user.id, email: user.email };
  }

  /* ------------------------------------------------------------------ */
  /*  Login                                                              */
  /* ------------------------------------------------------------------ */

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = this.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken };
  }

  /* ------------------------------------------------------------------ */
  /*  Email Verification                                                 */
  /* ------------------------------------------------------------------ */

  async verifyEmail(token: string): Promise<void> {
    const user = this.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Forgot Password                                                    */
  /* ------------------------------------------------------------------ */

  async forgotPassword(email: string): Promise<void> {
    const user = this.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return;
    }

    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;

    await this.sendPasswordResetEmail(user.email, resetToken);
  }

  /* ------------------------------------------------------------------ */
  /*  Reset Password                                                     */
  /* ------------------------------------------------------------------ */

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = this.findByResetToken(token);
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  private findByEmail(email: string): UserRecord | undefined {
    const normalised = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email === normalised) return user;
    }
    return undefined;
  }

  private findByVerificationToken(token: string): UserRecord | undefined {
    for (const user of this.users.values()) {
      if (user.emailVerificationToken === token) return user;
    }
    return undefined;
  }

  private findByResetToken(token: string): UserRecord | undefined {
    for (const user of this.users.values()) {
      if (user.passwordResetToken === token) return user;
    }
    return undefined;
  }

  /**
   * Replace with your email / notification service.
   */
  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const url = `${process.env.AUTH_EMAIL_VERIFICATION_URL}?token=${token}`;
    this.logger.log(`[SCAFFOLD] Verification email for ${email}: ${url}`);
  }

  /**
   * Replace with your email / notification service.
   */
  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = `${process.env.AUTH_PASSWORD_RESET_URL}?token=${token}`;
    this.logger.log(`[SCAFFOLD] Password reset email for ${email}: ${url}`);
  }
}
