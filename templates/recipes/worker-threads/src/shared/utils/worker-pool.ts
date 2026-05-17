import { Worker } from 'node:worker_threads';
import { Injectable, Logger } from '@nestjs/common';
import * as os from 'node:os';

interface WorkerTask<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

@Injectable()
export class WorkerPool {
  private readonly logger = new Logger(WorkerPool.name);
  private readonly workers: Worker[] = [];
  private readonly queue: Array<{ script: string; data: unknown; task: WorkerTask<unknown> }> = [];
  private readonly maxWorkers: number;

  constructor() {
    this.maxWorkers = Math.max(1, os.cpus().length - 1);
  }

  async run<T>(script: string, data: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.workers.length < this.maxWorkers) {
        this.spawn(script, data, { resolve: resolve as (v: unknown) => void, reject });
      } else {
        this.queue.push({
          script,
          data,
          task: { resolve: resolve as (v: unknown) => void, reject },
        });
      }
    });
  }

  private spawn(script: string, data: unknown, task: WorkerTask<unknown>): void {
    const worker = new Worker(script, { workerData: data });
    this.workers.push(worker);

    worker.on('message', (result) => {
      task.resolve(result);
      this.cleanup(worker);
    });

    worker.on('error', (error) => {
      task.reject(error);
      this.cleanup(worker);
    });
  }

  private cleanup(worker: Worker): void {
    const index = this.workers.indexOf(worker);
    if (index !== -1) this.workers.splice(index, 1);

    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.spawn(next.script, next.data, next.task);
    }
  }
}
