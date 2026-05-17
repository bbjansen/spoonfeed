import { Test } from '@nestjs/testing';
import { ExampleJob } from '@/jobs/example.job';

describe('ExampleJob', () => {
  let job: ExampleJob;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ExampleJob],
    }).compile();
    job = module.get(ExampleJob);
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });
});
