import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudLoggingService } from './logging.service';

@Module({
  imports: [ConfigModule],
  providers: [CloudLoggingService],
  exports: [CloudLoggingService],
})
export class CloudLoggingModule {}
