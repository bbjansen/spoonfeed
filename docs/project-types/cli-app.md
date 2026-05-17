# CLI App Project Type

## When to Use

Choose `cli-app` when you need a command-line tool built on NestJS. This gives you access to NestJS dependency injection, modules, and the full ecosystem while producing a CLI binary. Common use cases: database seeders, migration runners, data import/export tools, DevOps utilities, and internal tooling.

## nest-commander Overview

The project uses [nest-commander](https://docs.nestjs.com/recipes/nest-commander) to define commands as NestJS providers with decorators.

```
src/
  commands/
    seed/
      seed.command.ts
      seed.command.spec.ts
    migrate/
      migrate.command.ts
      migrate.command.spec.ts
  app.module.ts
  main.ts
```

### Entry Point

```typescript
// main.ts
import { CommandFactory } from 'nest-commander';
import { AppModule } from '@/app.module';

async function bootstrap() {
  await CommandFactory.run(AppModule, ['warn', 'error']);
}

bootstrap();
```

## Adding Commands and Subcommands

### Basic Command

```typescript
import { Command, CommandRunner } from 'nest-commander';
import { UserSeeder } from '@/seeders/user.seeder';

@Command({
  name: 'seed',
  description: 'Seed the database with sample data',
})
export class SeedCommand extends CommandRunner {
  constructor(private readonly userSeeder: UserSeeder) {
    super();
  }

  async run(): Promise<void> {
    await this.userSeeder.seed();
    console.log('Database seeded successfully');
  }
}
```

### Subcommands

Group related operations under a parent command.

```typescript
@Command({
  name: 'db',
  description: 'Database management commands',
  subCommands: [DbMigrateCommand, DbSeedCommand, DbResetCommand],
})
export class DbCommand extends CommandRunner {
  async run(): Promise<void> {
    this.command.help();
  }
}

@SubCommand({
  name: 'migrate',
  description: 'Run pending migrations',
})
export class DbMigrateCommand extends CommandRunner {
  async run(): Promise<void> {
    // Run migrations
  }
}

@SubCommand({
  name: 'reset',
  description: 'Drop and recreate the database',
})
export class DbResetCommand extends CommandRunner {
  async run(): Promise<void> {
    // Reset database
  }
}
```

Usage:

```bash
pnpm cli db migrate
pnpm cli db seed
pnpm cli db reset
```

## Arguments and Options

### Positional Arguments

```typescript
import { Command, CommandRunner } from 'nest-commander';

@Command({
  name: 'import',
  arguments: '<file>',
  description: 'Import data from a file',
})
export class ImportCommand extends CommandRunner {
  async run(args: string[]): Promise<void> {
    const [file] = args;
    console.log(`Importing from ${file}`);
  }
}
```

### Options (Flags)

```typescript
import { Command, CommandRunner, Option } from 'nest-commander';

interface ExportOptions {
  format: string;
  output: string;
  limit?: number;
}

@Command({
  name: 'export',
  description: 'Export data to a file',
})
export class ExportCommand extends CommandRunner {
  async run(args: string[], options: ExportOptions): Promise<void> {
    console.log(
      `Exporting ${options.limit ?? 'all'} records as ${options.format} to ${options.output}`,
    );
  }

  @Option({
    flags: '-f, --format <format>',
    description: 'Output format (json, csv)',
    defaultValue: 'json',
  })
  parseFormat(val: string): string {
    if (!['json', 'csv'].includes(val)) {
      throw new Error('Format must be json or csv');
    }
    return val;
  }

  @Option({
    flags: '-o, --output <path>',
    description: 'Output file path',
    required: true,
  })
  parseOutput(val: string): string {
    return val;
  }

  @Option({
    flags: '-l, --limit <number>',
    description: 'Maximum records to export',
  })
  parseLimit(val: string): number {
    return parseInt(val, 10);
  }
}
```

Usage:

```bash
pnpm cli export --format csv --output ./data.csv --limit 1000
```

## Testing CLI Commands

nest-commander provides `TestingModule` utilities for testing commands without spawning a process.

```typescript
import { TestingModule } from '@nestjs/testing';
import { CommandTestFactory } from 'nest-commander-testing';
import { AppModule } from '@/app.module';
import { UserSeeder } from '@/seeders/user.seeder';

describe('SeedCommand', () => {
  let commandModule: TestingModule;
  let userSeeder: UserSeeder;

  beforeEach(async () => {
    commandModule = await CommandTestFactory.createTestingCommand({
      imports: [AppModule],
    }).compile();

    userSeeder = commandModule.get(UserSeeder);
  });

  it('should call userSeeder.seed()', async () => {
    const seedSpy = jest.spyOn(userSeeder, 'seed').mockResolvedValue(undefined);

    await CommandTestFactory.run(commandModule, ['seed']);

    expect(seedSpy).toHaveBeenCalledTimes(1);
  });

  it('should pass options to export command', async () => {
    await CommandTestFactory.run(commandModule, [
      'export',
      '--format',
      'csv',
      '--output',
      './out.csv',
    ]);

    // Assert on expected behavior
  });
});
```
