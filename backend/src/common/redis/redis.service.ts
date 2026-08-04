import { Injectable, InternalServerErrorException, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Shared Redis connection for caching, sessions, rate limits, etc.
 * Configure with `REDIS_URL` (e.g. `redis://redis:6379`).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private lastErrorLogAt = 0;
  readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      throw new InternalServerErrorException('REDIS_URL is not configured');
    }
    this.client = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
    // Required: without this, ioredis emits "Unhandled error event" on every reconnect failure.
    this.client.on('error', (err) => {
      const now = Date.now();
      if (now - this.lastErrorLogAt < 30_000) return;
      this.lastErrorLogAt = now;
      this.logger.error(`Redis connection error: ${err.message}`);
    });
    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
