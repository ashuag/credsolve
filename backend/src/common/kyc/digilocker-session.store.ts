import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const TTL_SECONDS = 30 * 60;

export type DigilockerVendorKind = 'surepass' | 'tenacio';

export type DigilockerStoredSession = {
  token: string;
  vendor: DigilockerVendorKind | null;
};

@Injectable()
export class DigilockerSessionStore {
  constructor(private readonly redis: RedisService) {}

  private key(applicationUuid: string): string {
    return `moneycash:digilocker:session:${applicationUuid.trim()}`;
  }

  async save(
    applicationUuid: string,
    sessionToken: string,
    vendor?: DigilockerVendorKind | null,
  ): Promise<void> {
    const token = sessionToken.trim();
    const uuid = applicationUuid.trim();
    if (!token || !uuid) return;
    const payload =
      vendor === 'surepass' || vendor === 'tenacio'
        ? JSON.stringify({ token, vendor } satisfies DigilockerStoredSession)
        : token;
    try {
      await this.redis.client.set(this.key(uuid), payload, 'EX', TTL_SECONDS);
    } catch {
      /* Redis optional for dev — client may still have sessionStorage */
    }
  }

  async read(applicationUuid: string): Promise<string | null> {
    const stored = await this.readSession(applicationUuid);
    return stored?.token ?? null;
  }

  async readSession(applicationUuid: string): Promise<DigilockerStoredSession | null> {
    const uuid = applicationUuid.trim();
    if (!uuid) return null;
    try {
      const raw = await this.redis.client.get(this.key(uuid));
      const value = raw?.trim();
      if (!value) return null;
      if (value.startsWith('{')) {
        try {
          const parsed = JSON.parse(value) as Partial<DigilockerStoredSession>;
          if (typeof parsed.token === 'string' && parsed.token.trim()) {
            const vendor =
              parsed.vendor === 'surepass' || parsed.vendor === 'tenacio' ? parsed.vendor : null;
            return { token: parsed.token.trim(), vendor };
          }
        } catch {
          /* fall through to plain token */
        }
      }
      return { token: value, vendor: null };
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
