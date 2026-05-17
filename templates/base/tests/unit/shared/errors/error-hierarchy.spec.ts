import {
  ApplicationError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InvalidRequestError,
  RequesterError,
} from '@/shared/errors';

describe('ApplicationError', () => {
  it('should set all properties', () => {
    const err = new ApplicationError('msg', 'T_001', 'CODE', 500, { key: 'val' });
    expect(err.message).toBe('msg');
    expect(err.traceCode).toBe('T_001');
    expect(err.errorCode).toBe('CODE');
    expect(err.statusCode).toBe(500);
    expect(err.debugInfo).toEqual({ key: 'val' });
    expect(err.name).toBe('ApplicationError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should default statusCode to 500', () => {
    const err = new ApplicationError('msg', 'T', 'C');
    expect(err.statusCode).toBe(500);
  });

  it('should allow undefined debugInfo', () => {
    const err = new ApplicationError('msg', 'T', 'C');
    expect(err.debugInfo).toBeUndefined();
  });
});

describe.each([
  { Class: ValidationError, code: 'VALIDATION_ERROR', status: 400 },
  { Class: NotFoundError, code: 'NOT_FOUND', status: 404 },
  { Class: ForbiddenError, code: 'FORBIDDEN', status: 403 },
  { Class: InvalidRequestError, code: 'INVALID_REQUEST', status: 400 },
  { Class: RequesterError, code: 'REQUESTER_ERROR', status: 502 },
])('$Class.name', ({ Class, code, status }) => {
  it(`should have statusCode ${status}`, () => {
    const err = new Class('msg', 'T_001');
    expect(err.statusCode).toBe(status);
  });

  it(`should have errorCode ${code}`, () => {
    const err = new Class('msg', 'T_001');
    expect(err.errorCode).toBe(code);
  });

  it('should preserve traceCode', () => {
    const err = new Class('msg', 'A_NF_00001');
    expect(err.traceCode).toBe('A_NF_00001');
  });

  it('should carry debugInfo', () => {
    const err = new Class('msg', 'T', { userId: 42 });
    expect(err.debugInfo).toEqual({ userId: 42 });
  });

  it('should be instanceof ApplicationError', () => {
    const err = new Class('msg', 'T');
    expect(err).toBeInstanceOf(ApplicationError);
  });

  it('should have correct name', () => {
    const err = new Class('msg', 'T');
    expect(err.name).toBe(Class.name);
  });
});
