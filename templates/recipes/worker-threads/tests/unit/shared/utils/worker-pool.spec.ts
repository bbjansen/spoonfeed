import { WorkerPool } from '../../../../src/shared/utils/worker-pool';

jest.mock('node:worker_threads', () => {
  const EventEmitter = require('node:events');

  class MockWorker extends EventEmitter {
    constructor(_script: string, _opts: any) {
      super();
      // Simulate async message delivery
      process.nextTick(() => this.emit('message', { result: 'ok' }));
    }
    terminate() {
      return Promise.resolve(0);
    }
  }

  return { Worker: MockWorker };
});

describe('WorkerPool', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool();
  });

  it('should initialise with maxWorkers based on CPU count', () => {
    const maxWorkers = (pool as any).maxWorkers;
    expect(maxWorkers).toBeGreaterThanOrEqual(1);
  });

  it('should run a task and return the result', async () => {
    const result = await pool.run<{ result: string }>('worker.js', { input: 1 });
    expect(result).toEqual({ result: 'ok' });
  });
});
