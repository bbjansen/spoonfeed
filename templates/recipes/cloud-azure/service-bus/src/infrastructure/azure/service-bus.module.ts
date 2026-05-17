import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ServiceBusService } from './service-bus.service';

@Module({
  imports: [ConfigModule],
  providers: [ServiceBusService],
  exports: [ServiceBusService],
})
export class ServiceBusModule {}
