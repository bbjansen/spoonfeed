export class ApplicationError extends Error {
  public readonly traceCode: string;
  public readonly errorCode: string;
  public readonly statusCode: number;
  public readonly debugInfo?: Record<string, unknown>;

  constructor(
    message: string,
    traceCode: string,
    errorCode: string,
    statusCode: number = 500,
    debugInfo?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.traceCode = traceCode;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.debugInfo = debugInfo;
  }
}
