import { ApplicationError } from './application.error';

export class InvalidRequestError extends ApplicationError {
  constructor(message: string, traceCode: string, debugInfo?: Record<string, unknown>) {
    super(message, traceCode, 'INVALID_REQUEST', 400, debugInfo);
  }
}
