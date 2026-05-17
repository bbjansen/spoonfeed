import { Registry } from 'prom-client';
import { MetricsController } from '../../../../src/infrastructure/metrics/metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    controller = new MetricsController(registry);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return metrics string from getMetrics', async () => {
    const result = await controller.getMetrics();

    expect(typeof result).toBe('string');
  });
});
