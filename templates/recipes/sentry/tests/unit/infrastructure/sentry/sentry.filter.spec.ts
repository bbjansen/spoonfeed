import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { SentryExceptionFilter } from '../../../../src/infrastructure/sentry/sentry.filter';

jest.mock('@sentry/nestjs', () => ({
  withScope: jest.fn(),
  captureException: jest.fn(),
}));

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter;
  let mockSend: jest.Mock;
  let mockStatus: jest.Mock;

  const createMockHost = (): ArgumentsHost => {
    mockSend = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ send: mockSend });

    return {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: '/test', method: 'GET', headers: {} }),
      }),
    } as unknown as ArgumentsHost;
  };

  beforeEach(() => {
    filter = new SentryExceptionFilter();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should use the status from HttpException', () => {
    const host = createMockHost();
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('should default to 500 for non-HttpException errors', () => {
    const host = createMockHost();

    filter.catch(new Error('unexpected'), host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
