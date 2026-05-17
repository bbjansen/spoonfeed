import { ConfigService } from '@nestjs/config';

jest.mock('seq-logging', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    emit: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { SeqTransport } from '../../../../src/infrastructure/logging/seq.transport';

describe('SeqTransport', () => {
  let transport: SeqTransport;

  beforeEach(() => {
    const configService = new ConfigService({
      SEQ_SERVER_URL: 'http://localhost:5341',
      SEQ_API_KEY: 'test-api-key',
    });

    transport = new SeqTransport(configService);
  });

  it('should create a Seq logger on construction', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Logger } = require('seq-logging');
    expect(Logger).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: 'http://localhost:5341',
        apiKey: 'test-api-key',
      }),
    );
  });

  it('should emit info-level log events', () => {
    transport.info('User {UserId} logged in', { UserId: '42' });
    // Access the internal mock to verify emit was called
    const loggerInstance = (transport as any).logger;
    expect(loggerInstance.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'Information',
        messageTemplate: 'User {UserId} logged in',
        properties: { UserId: '42' },
      }),
    );
  });

  it('should close the logger on module destroy', async () => {
    const loggerInstance = (transport as any).logger;
    await transport.onModuleDestroy();
    expect(loggerInstance.close).toHaveBeenCalled();
  });
});
