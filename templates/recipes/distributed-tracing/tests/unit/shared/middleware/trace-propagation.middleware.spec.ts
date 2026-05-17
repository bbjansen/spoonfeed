import {
  TracePropagationMiddleware,
  traceStorage,
} from '../../../../src/shared/middleware/trace-propagation.middleware';

function createMockRequest(headers: Record<string, string> = {}) {
  return { headers };
}

function createMockResponse() {
  const responseHeaders: Record<string, string> = {};
  return {
    setHeader: jest.fn((key: string, value: string) => {
      responseHeaders[key] = value;
    }),
    _headers: responseHeaders,
  };
}

describe('TracePropagationMiddleware', () => {
  let middleware: TracePropagationMiddleware;

  beforeEach(() => {
    middleware = new TracePropagationMiddleware();
  });

  it('should create a new trace context when no traceparent header is present', (done) => {
    const req = createMockRequest();
    const res = createMockResponse();

    middleware.use(req as any, res as any, () => {
      const ctx = traceStorage.getStore();

      expect(ctx).toBeDefined();
      expect(ctx!.traceId).toHaveLength(32);
      expect(ctx!.spanId).toHaveLength(16);
      expect(ctx!.traceFlags).toBe(1);
      expect(ctx!.parentSpanId).toBeUndefined();
      expect(res.setHeader).toHaveBeenCalledWith('traceparent', expect.stringMatching(/^00-/));
      done();
    });
  });

  it('should parse an incoming traceparent header and preserve the traceId', (done) => {
    const traceId = 'a'.repeat(32);
    const parentSpanId = 'b'.repeat(16);
    const traceparent = `00-${traceId}-${parentSpanId}-01`;
    const req = createMockRequest({ traceparent });
    const res = createMockResponse();

    middleware.use(req as any, res as any, () => {
      const ctx = traceStorage.getStore();

      expect(ctx).toBeDefined();
      expect(ctx!.traceId).toBe(traceId);
      expect(ctx!.parentSpanId).toBe(parentSpanId);
      expect(ctx!.spanId).toHaveLength(16);
      expect(ctx!.spanId).not.toBe(parentSpanId);
      done();
    });
  });

  it('should fall back to a new context if traceparent is malformed', (done) => {
    const req = createMockRequest({ traceparent: 'invalid-header' });
    const res = createMockResponse();

    middleware.use(req as any, res as any, () => {
      const ctx = traceStorage.getStore();

      expect(ctx).toBeDefined();
      expect(ctx!.traceId).toHaveLength(32);
      expect(ctx!.parentSpanId).toBeUndefined();
      done();
    });
  });
});
