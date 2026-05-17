import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

describe('DatabaseModule', () => {
  it('should compile with config', async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();
    expect(module).toBeDefined();
  });
});
