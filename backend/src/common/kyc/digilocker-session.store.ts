import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const TTL_SECONDS = 30 * 60;

@Injectable()
export class DigilockerSessionStore {
  constructor(private readonly redis: RedisService) {}

  private key(applicationUuid: string): string {
    return `moneycash:digilocker:session:${applicationUuid.trim()}`;
  }

  async save(applicationUuid: string, sessionToken: string): Promise<void> {
    const token = sessionToken.trim();
    const uuid = applicationUuid.trim();
    if (!token || !uuid) return;
    try {
      await this.redis.client.set(this.key(uuid), token, 'EX', TTL_SECONDS);
    } catch {
      /* Redis optional for dev — client may still have sessionStorage */
    }
  }

  async read(applicationUuid: string): Promise<string | null> {
    const uuid = applicationUuid.trim();
    if (!uuid) return null;
    try {
      const raw = await this.redis.client.get(this.key(uuid));
      return raw?.trim() || null;
    } catch {
      return null;
    }
  }

  async clear(applicationUuid: string): Promise<void> {
    const uuid = applicationUuid.trim();
    if (!uuid) return;
    try {
      await this.redis.client.del(this.key(uuid));
    } catch {
      /* ignore */
    }
  }
}
