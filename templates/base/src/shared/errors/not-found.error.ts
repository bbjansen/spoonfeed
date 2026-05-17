import { ApplicationError } from './application.error';

export class NotFoundError extends ApplicationError {
  constructor(message: string, traceCode: string, debugInfo?: Record<string, unknown>) {
    super(message, traceCode, 'NOT_FOUND', 404, debugInfo);
  }
}
