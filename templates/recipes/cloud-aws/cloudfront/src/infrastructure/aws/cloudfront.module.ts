import { Module } from '@nestjs/common';
import { CloudFrontService } from './cloudfront.service';

@Module({
  providers: [CloudFrontService],
  exports: [CloudFrontService],
})
export class CloudFrontModule {}
