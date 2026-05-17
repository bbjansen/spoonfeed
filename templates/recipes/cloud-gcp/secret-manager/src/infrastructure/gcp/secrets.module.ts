import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GcpSecretsService } from './secrets.service';

@Module({
  imports: [ConfigModule],
  providers: [GcpSecretsService],
  exports: [GcpSecretsService],
})
export class GcpSecretsModule {}
