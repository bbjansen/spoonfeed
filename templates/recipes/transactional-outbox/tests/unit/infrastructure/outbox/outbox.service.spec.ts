import { OutboxService } from '../../../../src/infrastructure/outbox/outbox.service';
import { EntityManager } from 'typeorm';

describe('OutboxService', () => {
  let service: OutboxService;
  let mockManager: jest.Mocked<Pick<EntityManager, 'query'>>;

  beforeEach(() => {
    service = new OutboxService();
    mockManager = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('should insert a row into the outbox table with correct parameters', async () => {
    const payload = { orderId: 'abc-123', total: 99.95 };

    await service.addMessage(
      mockManager as unknown as EntityManager,
      'Order',
      'order-1',
      'OrderCreated',
      payload,
    );

    expect(mockManager.query).toHaveBeenCalledTimes(1);

    const [sql, params] = mockManager.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO outbox');
    expect(params).toEqual(['Order', 'order-1', 'OrderCreated', JSON.stringify(payload)]);
  });

  it('should propagate errors from the entity manager', async () => {
    mockManager.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      service.addMessage(mockManager as unknown as EntityManager, 'User', 'u-1', 'UserCreated', {}),
    ).rejects.toThrow('connection lost');
  });
});
