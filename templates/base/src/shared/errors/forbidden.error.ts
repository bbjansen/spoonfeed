import { ApplicationError } from './application.error';

export class ForbiddenError extends ApplicationError {
  constructor(message: string, traceCode: string, debugInfo?: Record<string, unknown>) {
    super(message, traceCode, 'FORBIDDEN', 403, debugInfo);
  }
}
