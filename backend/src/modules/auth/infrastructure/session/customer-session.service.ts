import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RedisService } from '../../../../common/redis/redis.service';
import type { CustomerSessionPayload } from '../../application/contracts/customer-session-payload.contract';
import { SettingsRepository } from '../repositories/settings.repository';
import { buildCustomerAuthCookieOptions } from './customer-auth-cookie.util';

const KEY_PREFIX = 'mc:cs:';

interface StoredCustomerSession {
  sub: string;
  mobile: string;
  createdAt: string;
  lastSeenAt: string;
  createdIp?: string;
  createdUa?: string;
  lastIp?: string;
  lastUa?: string;
}

@Injectable()
export class CustomerSessionService {
  private readonly logger = new Logger(CustomerSessionService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly settingsRepository: SettingsRepository
  ) {}

  private storageKey(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
  }

  private newSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  async createSession(params: {
    customerUuid: string;
    mobileNumber: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ sessionId: string; maxAgeMs: number; cookieName: string }> {
    const settings = await this.settingsRepository.loadAuthOtpSettings();
    const sessionId = this.newSessionId();
    const now = new Date().toISOString();
    const payload: StoredCustomerSession = {
      sub: params.customerUuid,
      mobile: params.mobileNumber,
      createdAt: now,
      lastSeenAt: now,
      createdIp: params.ip,
      createdUa: params.userAgent,
      lastIp: params.ip,
      lastUa: params.userAgent,
    };
    await this.redisService.client.set(this.storageKey(sessionId), JSON.stringify(payload), 'PX', settings.sessionTtlMs);
    return {
      sessionId,
      maxAgeMs: settings.sessionTtlMs,
      cookieName: settings.authCookieName,
    };
  }

  async revokeSession(sessionId: string | undefined): Promise<void> {
    if (!sessionId || sessionId.length < 32) {
      return;
    }
    await this.redisService.client.del(this.storageKey(sessionId));
  }

  /**
   * Validates the opaque cookie against Redis, applies sliding TTL and/or rotation, sets {@link Request.customerSession}.
   * Skips mutation for `POST .../auth/logout` so logout can revoke the presented session id without rotating first.
   */
  async attachCustomerSession(req: Request, res: Response): Promise<void> {
    if (req.method === 'POST') {
      const pathOnly = req.originalUrl?.split('?')[0] ?? '';
      if (pathOnly.endsWith('/auth/logout')) {
        return;
      }
    }
    delete req.customerSession;
    const settings = await this.settingsRepository.loadAuthOtpSettings();
    const sid = req.cookies?.[settings.authCookieName] as string | undefined;
    if (!sid || typeof sid !== 'string' || sid.length < 32) {
      return;
    }

    try {
      const raw = await this.redisService.client.get(this.storageKey(sid));
      if (!raw) {
        return;
      }

      let data: StoredCustomerSession;
      try {
        data = JSON.parse(raw) as StoredCustomerSession;
      } catch {
        await this.redisService.client.del(this.storageKey(sid));
        return;
      }

      if (typeof data.sub !== 'string' || typeof data.mobile !== 'string') {
        await this.redisService.client.del(this.storageKey(sid));
        return;
      }

      const xf = req.headers['x-forwarded-for'];
      const ip =
        (typeof xf === 'string' && xf.length > 0 ? xf.split(',')[0]?.trim() : undefined) ||
        req.socket.remoteAddress ||
        undefined;
      const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;

      const now = new Date().toISOString();
      data.lastSeenAt = now;
      data.lastIp = ip;
      data.lastUa = ua;

      const ttl = settings.sessionTtlMs;
      const serialized = JSON.stringify(data);

      if (settings.sessionRotateOnUse) {
        const newSid = this.newSessionId();
        const pipeline = this.redisService.client.pipeline();
        pipeline.set(this.storageKey(newSid), serialized, 'PX', ttl);
        pipeline.del(this.storageKey(sid));
        await pipeline.exec();
        res.cookie(settings.authCookieName, newSid, buildCustomerAuthCookieOptions(ttl));
      } else if (settings.sessionSliding) {
        await this.redisService.client.set(this.storageKey(sid), serialized, 'PX', ttl);
      } else {
        const remaining = await this.redisService.client.pttl(this.storageKey(sid));
        if (remaining > 0) {
          await this.redisService.client.set(this.storageKey(sid), serialized, 'PX', remaining);
        }
      }

      req.customerSession = { sub: data.sub, mobile: data.mobile };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis session attach failed (continuing without session): ${msg}`);
    }
  }
}
