import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const TTL_SECONDS = 30 * 60;

@Injectable()
export class AadhaarXmlOtpStore {
  constructor(private readonly redis: RedisService) {}

  private key(applicationUuid: string): string {
    return `moneycash:aadhaar-xml-otp:reference:${applicationUuid.trim()}`;
  }

  async save(applicationUuid: string, referenceId: string): Promise<void> {
    const uuid = applicationUuid.trim();
    const ref = referenceId.trim();
    if (!uuid || !ref) return;
    try {
      await this.redis.client.set(this.key(uuid), ref, 'EX', TTL_SECONDS);
    } catch {
      /* Redis optional for dev */
    }
  }

  async read(applicationUuid: string): Promise<string | null> {
    const uuid = applicationUuid.trim();
    if (!uuid) return null;
    try {
      const value = (await this.redis.client.get(this.key(uuid)))?.trim();
      return value || null;
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
