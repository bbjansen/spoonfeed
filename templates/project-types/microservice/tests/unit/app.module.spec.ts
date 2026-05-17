import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';

describe('Microservice AppModule', () => {
  it('should compile', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(module).toBeDefined();
  });
});
