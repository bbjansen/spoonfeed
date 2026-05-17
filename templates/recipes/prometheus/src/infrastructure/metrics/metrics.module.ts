import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [
    {
      provide: 'PROM_REGISTRY',
      useFactory: (configService: ConfigService) => {
        const registry = new Registry();
        const prefix = configService.get<string>('METRICS_PREFIX');

        if (prefix) {
          registry.setDefaultLabels({ app: prefix });
        }

        collectDefaultMetrics({ register: registry });

        return registry;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['PROM_REGISTRY'],
})
export class MetricsModule {}
