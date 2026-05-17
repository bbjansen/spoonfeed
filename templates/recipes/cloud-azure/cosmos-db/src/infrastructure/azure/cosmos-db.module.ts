import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CosmosDbService } from './cosmos-db.service';

@Module({
  imports: [ConfigModule],
  providers: [CosmosDbService],
  exports: [CosmosDbService],
})
export class CosmosDbModule {}
