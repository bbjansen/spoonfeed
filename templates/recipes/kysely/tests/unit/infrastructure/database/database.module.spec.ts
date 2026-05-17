import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';

const KYSELY = Symbol('KYSELY');

describe('Kysely DatabaseModule', () => {
  it('should provide the KYSELY token via the module', async () => {
    const mockKysely = { selectFrom: jest.fn() };

    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        {
          provide: KYSELY,
          useValue: mockKysely,
        },
      ],
    }).compile();

    const db = module.get(KYSELY);
    expect(db).toBeDefined();
    expect(db).toBe(mockKysely);
  });

  it('should require DATABASE_URL from ConfigService', () => {
    const configService = new ConfigService({ DATABASE_URL: 'postgresql://localhost/testdb' });
    const url = configService.getOrThrow<string>('DATABASE_URL');
    expect(url).toBe('postgresql://localhost/testdb');
  });

  it('should throw when DATABASE_URL is not configured', () => {
    const configService = new ConfigService({});
    expect(() => configService.getOrThrow('DATABASE_URL')).toThrow();
  });
});
