import { Module } from '@nestjs/common';
import { SsmService } from './ssm.service';

@Module({
  providers: [SsmService],
  exports: [SsmService],
})
export class SsmModule {}
