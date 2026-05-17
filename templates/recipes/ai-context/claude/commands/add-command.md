# Add CLI Command

Scaffold a new CLI command using nest-commander.

## Prompt

Ask the user for:

1. **Command name** (e.g. `sync-users`, `generate-report`)
2. **Description** — short summary shown in `--help` output
3. **Options/arguments** — any flags or positional arguments the command accepts

## Steps

1. **Create the command** at `src/commands/<command-name>.command.ts`:

   ```ts
   import { Command, CommandRunner, Option } from 'nest-commander';

   @Command({
     name: 'sync-users',
     description: 'Synchronize users from external source',
   })
   export class SyncUsersCommand extends CommandRunner {
     async run(passedParams: string[]): Promise<void> {
       // command logic
     }

     @Option({
       flags: '-d, --dry-run',
       description: 'Preview changes without applying them',
     })
     parseDryRun(val: string): boolean {
       return true;
     }
   }
   ```

2. **Extract business logic** — if the command does more than orchestration, create a dedicated service (e.g. `src/users/user-sync.service.ts`) and inject it into the command

3. **Register in module** — add the command class to the `providers` array of the relevant module (usually `AppModule` or a feature module)

4. **Create test stub** at `tests/unit/commands/<command-name>.command.spec.ts`:
   - Use `TestingModule` from `@nestjs/testing`
   - Test the `run()` method with different arguments and options
   - Mock injected services

5. **Verify** — run `pnpm build` and `pnpm test`
