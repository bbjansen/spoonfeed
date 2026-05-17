import { RequestLoggingMiddleware } from '../../../../src/shared/middleware/request-logging.middleware';
import { EventEmitter } from 'node:events';

function createMockRequest(
  overrides: Partial<{ method: string; url: string; headers: Record<string, string> }> = {},
) {
  return {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/api/test',
    headers: overrides.headers ?? {},
  };
}

function createMockResponse(): EventEmitter & { statusCode: number; getHeader: jest.Mock } {
  const res = new EventEmitter() as EventEmitter & { statusCode: number; getHeader: jest.Mock };
  res.statusCode = 200;
  res.getHeader = jest.fn().mockReturnValue('42');
  return res;
}

describe('RequestLoggingMiddleware', () => {
  let middleware: RequestLoggingMiddleware;

  beforeEach(() => {
    middleware = new RequestLoggingMiddleware();
  });

  it('should call next immediately and log on response finish', (done) => {
    const req = createMockRequest({ method: 'GET', url: '/api/users' });
    const res = createMockResponse();
    const logSpy = jest.spyOn((middleware as any).logger, 'log').mockImplementation();

    middleware.use(req as any, res as any, () => {
      res.statusCode = 200;
      res.emit('finish');

      expect(logSpy).toHaveBeenCalledTimes(1);
      const logData = logSpy.mock.calls[0][0];
      expect(logData).toEqual(
        expect.objectContaining({ method: 'GET', url: '/api/users', statusCode: 200 }),
      );
      done();
    });
  });

  it('should use warn for 4xx responses and error for 5xx responses', (done) => {
    const req = createMockRequest();
    const res = createMockResponse();
    const warnSpy = jest.spyOn((middleware as any).logger, 'warn').mockImplementation();
    const errorSpy = jest.spyOn((middleware as any).logger, 'error').mockImplementation();

    middleware.use(req as any, res as any, () => {
      res.statusCode = 404;
      res.emit('finish');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      res.statusCode = 503;
      res.emit('finish');
      expect(errorSpy).toHaveBeenCalledTimes(1);

      done();
    });
  });
});
