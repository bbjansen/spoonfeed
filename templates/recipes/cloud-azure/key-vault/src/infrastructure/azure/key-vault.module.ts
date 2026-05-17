import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { KeyVaultService } from './key-vault.service';

@Module({
  imports: [ConfigModule],
  providers: [KeyVaultService],
  exports: [KeyVaultService],
})
export class KeyVaultModule {}
