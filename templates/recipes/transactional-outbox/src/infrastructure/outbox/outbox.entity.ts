import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('outbox')
export class OutboxMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  aggregateType: string;

  @Column()
  aggregateId: string;

  @Column()
  eventType: string;

  @Column('jsonb')
  payload: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: false })
  @Index()
  published: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;
}
