import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

export type LosSessionPayload = {
  userId: string;
  email: string;
  roleId: number;
  roleName: string | null;
};

const LOS_SESSION_TTL_SECONDS = 60 * 60 * 24;
const LOS_SESSION_PREFIX = 'los:session:';

@Injectable()
export class LosSessionService {
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
    const raw = await this.redis.client.get(`${LOS_SESSION_PREFIX}${token}`);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as LosSessionPayload;
    } catch {
      return null;
    }
  }
}
