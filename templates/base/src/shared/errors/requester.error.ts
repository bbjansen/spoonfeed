import { ApplicationError } from './application.error';

export class RequesterError extends ApplicationError {
  constructor(message: string, traceCode: string, debugInfo?: Record<string, unknown>) {
    super(message, traceCode, 'REQUESTER_ERROR', 502, debugInfo);
  }
}
