import { Module } from '@nestjs/common';
import { CloudWatchService } from './cloudwatch.service';

@Module({
  providers: [CloudWatchService],
  exports: [CloudWatchService],
})
export class CloudWatchModule {}
