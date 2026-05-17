import { ShutdownService } from '../../../../src/shared/lifecycle/shutdown.service';

describe('ShutdownService', () => {
  let service: ShutdownService;

  beforeEach(() => {
    service = new ShutdownService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute registered cleanup functions on shutdown', async () => {
    const fn1 = jest.fn().mockResolvedValue(undefined);
    const fn2 = jest.fn().mockResolvedValue(undefined);

    service.registerCleanup(fn1);
    service.registerCleanup(fn2);

    await service.onApplicationShutdown('SIGTERM');

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('should continue cleanup even if one function throws', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('boom'));
    const succeeding = jest.fn().mockResolvedValue(undefined);

    service.registerCleanup(failing);
    service.registerCleanup(succeeding);

    await service.onApplicationShutdown('SIGINT');

    expect(failing).toHaveBeenCalled();
    expect(succeeding).toHaveBeenCalled();
  });
});
