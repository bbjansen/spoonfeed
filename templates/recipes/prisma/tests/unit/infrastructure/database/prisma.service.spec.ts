import { PrismaService } from '../../../../src/infrastructure/database/prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should implement onModuleInit', async () => {
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('should implement onModuleDestroy', async () => {
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
