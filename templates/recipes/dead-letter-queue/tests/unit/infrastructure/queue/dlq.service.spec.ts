import { DeadLetterQueueService } from '../../../../src/infrastructure/queue/dlq.service';

describe('DeadLetterQueueService', () => {
  let service: DeadLetterQueueService;

  beforeEach(() => {
    service = new DeadLetterQueueService();
  });

  it('should add a message and retrieve it via getAll', () => {
    service.add({ queue: 'orders', payload: { id: 1 }, error: 'timeout', attempts: 3 });

    const messages = service.getAll();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(
      expect.objectContaining({
        queue: 'orders',
        payload: { id: 1 },
        error: 'timeout',
        attempts: 3,
      }),
    );
    expect(messages[0].id).toBeDefined();
    expect(messages[0].failedAt).toBeInstanceOf(Date);
  });

  it('should filter messages by queue name', () => {
    service.add({ queue: 'orders', payload: {}, error: 'fail', attempts: 1 });
    service.add({ queue: 'emails', payload: {}, error: 'fail', attempts: 1 });
    service.add({ queue: 'orders', payload: {}, error: 'retry', attempts: 2 });

    expect(service.getByQueue('orders')).toHaveLength(2);
    expect(service.getByQueue('emails')).toHaveLength(1);
    expect(service.getByQueue('unknown')).toHaveLength(0);
  });

  it('should remove a message by id and return true, or false if not found', () => {
    service.add({ queue: 'q', payload: {}, error: 'e', attempts: 1 });
    const id = service.getAll()[0].id;

    expect(service.remove(id)).toBe(true);
    expect(service.getAll()).toHaveLength(0);
    expect(service.remove('nonexistent-id')).toBe(false);
  });
});
