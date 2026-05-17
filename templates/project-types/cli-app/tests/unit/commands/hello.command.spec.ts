import { TestingModule, Test } from '@nestjs/testing';
import { CommandTestFactory } from 'nest-commander-testing';
import { AppModule } from '@/app.module';

describe('HelloCommand', () => {
  let commandInstance: TestingModule;

  beforeEach(async () => {
    commandInstance = await CommandTestFactory.createTestingCommand({
      imports: [AppModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(commandInstance).toBeDefined();
  });
});
