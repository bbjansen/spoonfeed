import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

// Import your AppModule — adjust the path to match your project structure
// import { AppModule } from '@/app.module';

const logger = new Logger('Seed');

interface Seeder {
  name: string;
  run: (app: unknown) => Promise<number>;
}

const seeders: Seeder[] = [
  {
    name: 'Users',
    run: async (_app) => {
      // Example: const userRepo = app.get(UserRepository);
      // await userRepo.save([
      //   { email: 'admin@example.com', name: 'Admin', role: 'admin' },
      //   { email: 'user@example.com', name: 'User', role: 'user' },
      // ]);
      logger.log('Seeding users — replace with actual implementation');
      return 2;
    },
  },
];

async function bootstrap(): Promise<void> {
  // Uncomment once AppModule is available:
  // const app = await NestFactory.createApplicationContext(AppModule);

  const app = null; // Remove this line when uncommenting above

  logger.log('Starting database seed...');

  let totalRecords = 0;

  for (const seeder of seeders) {
    try {
      const count = await seeder.run(app);
      totalRecords += count;
      logger.log(`Seeded ${count} ${seeder.name} records`);
    } catch (error) {
      logger.error(`Failed to seed ${seeder.name}: ${(error as Error).message}`);
      throw error;
    }
  }

  logger.log(`Seed complete — ${totalRecords} total records created`);

  // Uncomment once AppModule is available:
  // await app.close();

  process.exit(0);
}

bootstrap().catch((error) => {
  logger.error('Seed failed', error);
  process.exit(1);
});
