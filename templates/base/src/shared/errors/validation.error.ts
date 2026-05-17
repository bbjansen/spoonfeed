import { ApplicationError } from './application.error';

export class ValidationError extends ApplicationError {
  constructor(message: string, traceCode: string, debugInfo?: Record<string, unknown>) {
    super(message, traceCode, 'VALIDATION_ERROR', 400, debugInfo);
  }
}
