import { ExampleProcessor } from '../../../../src/infrastructure/queue/example.processor';

describe('ExampleProcessor', () => {
  let processor: ExampleProcessor;

  beforeEach(() => {
    processor = new ExampleProcessor();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should have a process method', () => {
    expect(typeof processor.process).toBe('function');
  });
});
