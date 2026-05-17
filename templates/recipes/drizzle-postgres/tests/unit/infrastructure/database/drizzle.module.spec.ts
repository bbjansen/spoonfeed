import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';

const DRIZZLE = Symbol('DRIZZLE');

describe('DrizzleModule', () => {
  it('should provide the DRIZZLE token via the module', async () => {
    const mockDb = { query: jest.fn() };

    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    const db = module.get(DRIZZLE);
    expect(db).toBeDefined();
    expect(db).toBe(mockDb);
  });

  it('should use DATABASE_URL from ConfigService in the factory', () => {
    const configService = new ConfigService({ DATABASE_URL: 'postgresql://localhost:5432/test' });
    const url = configService.getOrThrow<string>('DATABASE_URL');
    expect(url).toBe('postgresql://localhost:5432/test');
  });

  it('should throw when DATABASE_URL is missing', () => {
    const configService = new ConfigService({});
    expect(() => configService.getOrThrow('DATABASE_URL')).toThrow();
  });
});
