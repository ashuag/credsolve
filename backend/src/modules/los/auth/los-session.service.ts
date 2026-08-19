import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

export type LosSessionPayload = {
  userId: string;
  email: string;
  roleId: number;
  roleName: string | null;
  hierarchyLevel?: number | null;
};

const LOS_SESSION_TTL_SECONDS = 60 * 60 * 24;
const LOS_SESSION_PREFIX = 'los:session:';

function isLosSessionPayload(value: unknown): value is LosSessionPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.userId === 'string' &&
    typeof v.email === 'string' &&
    typeof v.roleId === 'number' &&
    (v.roleName === null || typeof v.roleName === 'string') &&
    (v.hierarchyLevel === undefined || v.hierarchyLevel === null || typeof v.hierarchyLevel === 'number')
  );
}

@Injectable()
export class LosSessionService {
  private readonly logger = new Logger(LosSessionService.name);

  constructor(private readonly redis: RedisService) {}

  async createSession(payload: LosSessionPayload): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.client.set(
      `${LOS_SESSION_PREFIX}${token}`,
      JSON.stringify(payload),
      'EX',
      LOS_SESSION_TTL_SECONDS
    );
    return token;
  }

  async getSession(token: string): Promise<LosSessionPayload | null> {
    const key = `${LOS_SESSION_PREFIX}${token}`;
    const raw = await this.redis.client.get(key);
    if (!raw) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(`Discarding malformed LOS session payload (key=${key}).`);
      await this.redis.client.del(key);
      return null;
    }

    if (!isLosSessionPayload(parsed)) {
      this.logger.warn(`Discarding LOS session payload with unexpected shape (key=${key}).`);
      await this.redis.client.del(key);
      return null;
    }

    return parsed;
  }
}
