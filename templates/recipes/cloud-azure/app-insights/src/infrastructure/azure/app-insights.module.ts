import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppInsightsService } from './app-insights.service';

@Module({
  imports: [ConfigModule],
  providers: [AppInsightsService],
  exports: [AppInsightsService],
})
export class AppInsightsModule {}
