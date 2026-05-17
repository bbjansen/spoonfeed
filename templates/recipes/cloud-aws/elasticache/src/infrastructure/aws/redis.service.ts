import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      tls: this.configService.get<boolean>('REDIS_TLS', false) ? {} : undefined,
    });
  }

  async get(key: string): Promise<string | null> {
    const value = await this.client.get(key);
    this.logger.debug(`GET ${key}: ${value !== null ? 'hit' : 'miss'}`);
    return value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
    this.logger.debug(`SET ${key}`);
  }

  async del(key: string): Promise<number> {
    const result = await this.client.del(key);
    this.logger.debug(`DEL ${key}: ${result}`);
    return result;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
