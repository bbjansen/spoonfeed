import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('example')
export class ExampleProcessor extends WorkerHost {
  private readonly logger = new Logger(ExampleProcessor.name);

  async process(job: Job<unknown, unknown, string>): Promise<void> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    this.logger.debug(`Job data: ${JSON.stringify(job.data)}`);

    switch (job.name) {
      case 'send-welcome':
        await this.handleSendWelcome(job);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSendWelcome(job: Job): Promise<void> {
    this.logger.log(`Sending welcome for job ${job.id}`);
  }
}
