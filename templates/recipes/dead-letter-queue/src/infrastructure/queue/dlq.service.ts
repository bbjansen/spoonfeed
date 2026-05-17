import { Injectable, Logger } from '@nestjs/common';

export interface DeadLetterMessage {
  id: string;
  queue: string;
  payload: unknown;
  error: string;
  attempts: number;
  failedAt: Date;
}

@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly messages: DeadLetterMessage[] = [];

  add(message: Omit<DeadLetterMessage, 'id' | 'failedAt'>): void {
    const dlqMessage: DeadLetterMessage = {
      ...message,
      id: crypto.randomUUID(),
      failedAt: new Date(),
    };
    this.messages.push(dlqMessage);
    this.logger.warn(`Message added to DLQ from queue "${message.queue}": ${message.error}`);
  }

  getAll(): DeadLetterMessage[] {
    return [...this.messages];
  }

  getByQueue(queue: string): DeadLetterMessage[] {
    return this.messages.filter((m) => m.queue === queue);
  }

  remove(id: string): boolean {
    const index = this.messages.findIndex((m) => m.id === id);
    if (index === -1) return false;
    this.messages.splice(index, 1);
    return true;
  }
}
