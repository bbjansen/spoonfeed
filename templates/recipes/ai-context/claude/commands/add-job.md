# Add Scheduled Job

Scaffold a new scheduled job using `@nestjs/schedule`.

## Prompt

Ask the user for:

1. **Job name** (e.g. `cleanup-expired-tokens`, `sync-inventory`)
2. **Schedule** — cron expression or a `CronExpression` constant (e.g. `EVERY_HOUR`, `EVERY_DAY_AT_MIDNIGHT`)

## Steps

1. **Create the job** at `src/jobs/<job-name>.job.ts`:

   ```ts
   import { Injectable, Logger } from '@nestjs/common';
   import { Cron, CronExpression } from '@nestjs/schedule';

   @Injectable()
   export class CleanupExpiredTokensJob {
     private readonly logger = new Logger(CleanupExpiredTokensJob.name);

     @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
     async handle(): Promise<void> {
       this.logger.log('Starting cleanup of expired tokens');
       // job logic
       this.logger.log('Cleanup complete');
     }
   }
   ```

2. **Extract business logic** — if the job does more than orchestration, create a dedicated service and inject it. Keep the job class focused on scheduling concerns only.

3. **Register in module** — add the job class to the `providers` array of the relevant module. Ensure `ScheduleModule.forRoot()` is imported in `AppModule`.

4. **Create test stub** at `tests/unit/jobs/<job-name>.job.spec.ts`:
   - Call the `handle()` method directly — do not test cron scheduling
   - Test success and error paths
   - Mock injected services

5. **Verify** — run `pnpm build` and `pnpm test`
