import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  async addMessage(
    manager: EntityManager,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO outbox (id, "aggregateType", "aggregateId", "eventType", payload, "createdAt", published)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), false)`,
      [aggregateType, aggregateId, eventType, JSON.stringify(payload)],
    );
  }
}
