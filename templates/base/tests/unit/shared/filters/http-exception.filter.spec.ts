import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '@/shared/filters/http-exception.filter';
import { NotFoundError } from '@/shared/errors/not-found.error';
import { ApplicationError } from '@/shared/errors/application.error';
import { ValidationError } from '@/shared/errors/validation.error';

const mockSend = jest.fn<void, [Record<string, unknown>]>();
const mockHeader = jest.fn().mockReturnValue({ send: mockSend });
const mockCode = jest.fn().mockReturnValue({ header: mockHeader });
const mockResponse = { code: mockCode };
const mockRequest = { method: 'GET', url: '/test' };

const createMockHost = (): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  }) as unknown as ArgumentsHost;

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    filter = new GlobalExceptionFilter();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('catch', () => {
    it('should handle HttpException with correct status and error code', () => {
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
      const host = createMockHost();

      filter.catch(exception, host);

      expect(mockCode).toHaveBeenCalledTimes(1);
      expect(mockCode).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockHeader).toHaveBeenCalledWith('content-type', 'application/problem+json');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const body = mockSend.mock.calls[0][0];
      expect(body.type).toBe('urn:error:not-found');
      expect(body.title).toBe('Not Found');
      expect(body.status).toBe(HttpStatus.NOT_FOUND);
      expect(body.detail).toBe('Not found');
      expect(body.errorCode).toBe('NOT_FOUND');
      expect(body.instance).toBe('/test');
      expect(body.timestamp).toBeDefined();
      expect(body.traceCode).toMatch(/^ERR_\d+_[A-Z0-9]+$/);
    });

    it('should handle unknown exception as 500 internal server error', () => {
      const exception = new Error('Unexpected error');
      const host = createMockHost();

      filter.catch(exception, host);

      expect(mockCode).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockHeader).toHaveBeenCalledWith('content-type', 'application/problem+json');

      const body = mockSend.mock.calls[0][0];
      expect(body.type).toBe('urn:error:internal-error');
      expect(body.title).toBe('Internal Server Error');
      expect(body.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.detail).toBe('Internal server error');
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should use HTTP_ERROR code for unmapped status codes', () => {
      const exception = new HttpException('Teapot', 418);
      const host = createMockHost();

      filter.catch(exception, host);

      const body = mockSend.mock.calls[0][0];
      expect(body.type).toBe('urn:error:http-error');
      expect(body.title).toBe('Error');
      expect(body.status).toBe(418);
      expect(body.errorCode).toBe('HTTP_ERROR');
    });

    it('should handle ApplicationError with static trace code', () => {
      const exception = new NotFoundError('User not found', 'A_NF_00001');
      const host = createMockHost();

      filter.catch(exception, host);

      expect(mockCode).toHaveBeenCalledWith(404);
      expect(mockHeader).toHaveBeenCalledWith('content-type', 'application/problem+json');

      const body = mockSend.mock.calls[0][0];
      expect(body.type).toBe('urn:error:not-found');
      expect(body.title).toBe('Not Found');
      expect(body.status).toBe(404);
      expect(body.detail).toBe('User not found');
      expect(body.errorCode).toBe('NOT_FOUND');
      expect(body.traceCode).toBe('A_NF_00001');
      expect(body.instance).toBe('/test');
      expect(body.timestamp).toBeDefined();
    });

    it('should handle ValidationError with 400 status', () => {
      const exception = new ValidationError('Invalid email', 'A_VL_00001', {
        field: 'email',
      });
      const host = createMockHost();

      filter.catch(exception, host);

      expect(mockCode).toHaveBeenCalledWith(400);

      const body = mockSend.mock.calls[0][0];
      expect(body.type).toBe('urn:error:validation-error');
      expect(body.title).toBe('Bad Request');
      expect(body.status).toBe(400);
      expect(body.detail).toBe('Invalid email');
      expect(body.errorCode).toBe('VALIDATION_ERROR');
      expect(body.traceCode).toBe('A_VL_00001');
    });

    it('should include debugInformation in non-production', () => {
      const debugInfo = { userId: 42, attemptedResource: '/admin' };
      const exception = new ApplicationError(
        'Something failed',
        'A_DB_00001',
        'DEBUG_TEST',
        500,
        debugInfo,
      );
      const host = createMockHost();

      filter.catch(exception, host);

      const body = mockSend.mock.calls[0][0];
      const debug = body.debugInformation as Record<string, unknown>;
      expect(debug).not.toBeNull();
      expect(debug.userId).toBe(42);
      expect(debug.attemptedResource).toBe('/admin');
      expect(debug.stack).toBeDefined();
    });

    it('should set debugInformation to null in production', () => {
      process.env.NODE_ENV = 'production';
      const productionFilter = new GlobalExceptionFilter();

      const exception = new ApplicationError('Something failed', 'A_DB_00002', 'DEBUG_TEST', 500, {
        secret: 'should-not-leak',
      });
      const host = createMockHost();

      productionFilter.catch(exception, host);

      const body = mockSend.mock.calls[0][0];
      expect(body.debugInformation).toBeNull();
    });

    it('should include debugInformation for HttpException in non-production', () => {
      const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      const host = createMockHost();

      filter.catch(exception, host);

      const body = mockSend.mock.calls[0][0];
      const debug = body.debugInformation as Record<string, unknown>;
      expect(debug).not.toBeNull();
      expect(debug.stack).toBeDefined();
    });

    it('should set debugInformation to null for HttpException in production', () => {
      process.env.NODE_ENV = 'production';
      const productionFilter = new GlobalExceptionFilter();

      const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      const host = createMockHost();

      productionFilter.catch(exception, host);

      const body = mockSend.mock.calls[0][0];
      expect(body.debugInformation).toBeNull();
    });
  });
});
