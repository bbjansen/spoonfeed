import { Module } from '@nestjs/common';

import { AuthFlowService } from './auth.service';
import { AuthFlowController } from './auth.controller';

@Module({
  controllers: [AuthFlowController],
  providers: [AuthFlowService],
  exports: [AuthFlowService],
})
export class AuthFlowModule {}
