import { LoggerModule } from '../../../../src/infrastructure/logging/logger.module';

describe('LoggerModule', () => {
  it('should be defined', () => {
    expect(LoggerModule).toBeDefined();
  });

  it('should be a class that can be referenced as a module', () => {
    expect(typeof LoggerModule).toBe('function');
    expect(LoggerModule.name).toBe('LoggerModule');
  });
});
