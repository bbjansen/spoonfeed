import { Module } from '@nestjs/common';
import { EventBridgeService } from './eventbridge.service';

@Module({
  providers: [EventBridgeService],
  exports: [EventBridgeService],
})
export class EventBridgeModule {}
