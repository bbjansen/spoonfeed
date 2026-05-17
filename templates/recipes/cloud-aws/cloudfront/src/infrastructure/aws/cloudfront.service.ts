import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

@Injectable()
export class CloudFrontService {
  private readonly keyPairId: string;
  private readonly privateKey: string;
  private readonly logger = new Logger(CloudFrontService.name);

  constructor(private readonly configService: ConfigService) {
    this.keyPairId = this.configService.getOrThrow<string>('CLOUDFRONT_KEY_PAIR_ID');
    this.privateKey = this.configService.getOrThrow<string>('CLOUDFRONT_PRIVATE_KEY');
  }

  getSignedUrl(url: string, expiresInSeconds = 3600): string {
    const dateLessThan = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const signedUrl = getSignedUrl({
      url,
      keyPairId: this.keyPairId,
      privateKey: this.privateKey,
      dateLessThan,
    });

    this.logger.debug(`Generated signed URL for ${url}`);
    return signedUrl;
  }
}
