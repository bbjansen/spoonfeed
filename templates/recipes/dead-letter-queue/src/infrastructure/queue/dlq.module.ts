import { Module } from '@nestjs/common';
import { DeadLetterQueueService } from './dlq.service';

@Module({
  providers: [DeadLetterQueueService],
  exports: [DeadLetterQueueService],
})
export class DlqModule {}
