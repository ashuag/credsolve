import { Injectable, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Shared Redis connection for caching, sessions, rate limits, etc.
 * Configure with `REDIS_URL` (e.g. `redis://redis:6379`).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      throw new InternalServerErrorException('REDIS_URL is not configured');
    }
    this.client = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
