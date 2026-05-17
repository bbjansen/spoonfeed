import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EntraIdService } from './entra-id.service';

@Module({
  imports: [ConfigModule],
  providers: [EntraIdService],
  exports: [EntraIdService],
})
export class EntraIdModule {}
