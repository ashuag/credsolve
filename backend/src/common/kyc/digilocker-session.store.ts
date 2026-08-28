import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

const TTL_SECONDS = 30 * 60;
const DOWNLOAD_LOCK_TTL_SEC = 90;
/** Redis unavailable — caller proceeds without a lock rather than blocking KYC. */
const SKIP_LOCK_TOKEN = '__skip__';

const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

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

  private downloadLockKey(applicationUuid: string): string {
    return `moneycash:digilocker:download-lock:${applicationUuid.trim()}`;
  }

  /**
   * Single-flight around Tenacio/Surepass Aadhaar download for one application.
   * Concurrent callers get `acquired: false` and must not hit the vendor.
   * After the lock is released (success or failure), a later call may acquire it again.
   */
  async tryAcquireDownloadLock(
    applicationUuid: string,
  ): Promise<{ acquired: boolean; token: string }> {
    const uuid = applicationUuid.trim();
    if (!uuid) return { acquired: true, token: SKIP_LOCK_TOKEN };
    const lockToken = randomUUID();
    try {
      const acquired = await this.redis.client.set(
        this.downloadLockKey(uuid),
        lockToken,
        'EX',
        DOWNLOAD_LOCK_TTL_SEC,
        'NX',
      );
      if (acquired === 'OK') return { acquired: true, token: lockToken };
      return { acquired: false, token: '' };
    } catch {
      return { acquired: true, token: SKIP_LOCK_TOKEN };
    }
  }

  async isDownloadLocked(applicationUuid: string): Promise<boolean> {
    const uuid = applicationUuid.trim();
    if (!uuid) return false;
    try {
      const value = await this.redis.client.get(this.downloadLockKey(uuid));
      return Boolean(value);
    } catch {
      return false;
    }
  }

  async releaseDownloadLock(applicationUuid: string, lockToken: string): Promise<void> {
    const uuid = applicationUuid.trim();
    if (!uuid || !lockToken || lockToken === SKIP_LOCK_TOKEN) return;
    try {
      await this.redis.client.eval(RELEASE_LOCK_SCRIPT, 1, this.downloadLockKey(uuid), lockToken);
    } catch {
      /* ignore */
    }
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
