import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.getOrThrow<string>('AZURE_REDIS_HOST'),
      port: this.config.get<number>('AZURE_REDIS_PORT', 6380),
      password: this.config.getOrThrow<string>('AZURE_REDIS_PASSWORD'),
      tls: { servername: this.config.getOrThrow<string>('AZURE_REDIS_HOST') },
    });

    this.client.on('connect', () => this.logger.log('Connected to Azure Cache for Redis'));
    this.client.on('error', (err) => this.logger.error('Redis connection error', err.stack));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
