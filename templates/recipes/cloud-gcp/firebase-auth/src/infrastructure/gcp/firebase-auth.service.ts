import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Auth, DecodedIdToken, UserRecord } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAuthService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthService.name);
  private auth: Auth;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.getOrThrow<string>('GCP_PROJECT_ID');

    if (!admin.apps.length) {
      admin.initializeApp({ projectId });
    }

    this.auth = admin.app().auth();
    this.logger.log('Firebase Auth initialized');
  }

  async verifyIdToken(idToken: string, checkRevoked = false): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(idToken, checkRevoked);
  }

  async getUser(uid: string): Promise<UserRecord> {
    return this.auth.getUser(uid);
  }

  async setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    await this.auth.setCustomUserClaims(uid, claims);
    this.logger.log(`Custom claims set for user ${uid}`);
  }

  async revokeRefreshTokens(uid: string): Promise<void> {
    await this.auth.revokeRefreshTokens(uid);
    this.logger.log(`Refresh tokens revoked for user ${uid}`);
  }
}
