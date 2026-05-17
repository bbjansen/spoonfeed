import { IdempotencyMiddleware } from '@/shared/middleware/idempotency.middleware';

describe('IdempotencyMiddleware', () => {
  let middleware: IdempotencyMiddleware;

  beforeEach(() => {
    middleware = new IdempotencyMiddleware();
  });

  it('should pass through when the request method is GET', () => {
    const req = { method: 'GET', headers: {} } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should pass through POST requests without an idempotency-key header', () => {
    const req = { method: 'POST', headers: {} } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should replay a cached response when the same idempotency key is used twice', () => {
    const key = 'unique-key-123';
    const req = { method: 'POST', headers: { 'idempotency-key': key } } as any;
    const endFn = jest.fn();
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      end: endFn,
    } as any;

    // First request: let it pass through and capture the response
    middleware.use(req, res, jest.fn());
    // Simulate the response ending with JSON body
    res.end(JSON.stringify({ id: 1 }));

    // Second request with same key: should replay
    const res2 = {
      statusCode: 0,
      setHeader: jest.fn(),
      end: jest.fn(),
    } as any;

    middleware.use(req, res2, jest.fn());

    expect(res2.setHeader).toHaveBeenCalledWith('x-idempotent-replayed', 'true');
  });
});
