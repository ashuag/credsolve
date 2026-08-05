import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_ROUTE_KEY, type RateLimitRouteId } from './rate-limit-route.decorator';

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip ?? 'unknown';
}

const DEFAULTS: Record<RateLimitRouteId, { max: number; windowSec: number }> = {
  'send-otp': { max: 40, windowSec: 3600 },
  'verify-otp': { max: 120, windowSec: 3600 },
  'verify-pan': { max: 40, windowSec: 3600 },
  'digilocker-init': { max: 20, windowSec: 3600 },
  'digilocker-aadhaar': { max: 30, windowSec: 3600 },
  'fetch-bureau': { max: 30, windowSec: 3600 },
  logout: { max: 60, windowSec: 3600 },
  'sync-lead-email': { max: 30, windowSec: 3600 },
  'save-lead-details': { max: 40, windowSec: 3600 },
  'save-lead-references': { max: 40, windowSec: 3600 },
  'professional-details': { max: 30, windowSec: 3600 },
  'loan-selection': { max: 30, windowSec: 3600 },
  'kyc-documents': { max: 20, windowSec: 3600 },
  'bank-details': { max: 20, windowSec: 3600 },
  'bank-ifsc-lookup': { max: 40, windowSec: 3600 },
  'bank-submit-verified': { max: 15, windowSec: 3600 },
  'loan-documents': { max: 60, windowSec: 3600 },
  'loan-documents-otp': { max: 20, windowSec: 3600 },
  'loan-repay': { max: 20, windowSec: 3600 },
};

@Injectable()
export class RedisIpRateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const routeId = this.reflector.get<RateLimitRouteId | undefined>(
      RATE_LIMIT_ROUTE_KEY,
      context.getHandler()
    );
    if (!routeId) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const ip = clientIp(req);
    const { max, windowSec } = this.limitsFor(routeId);

    const redisKey = `rl:auth:${routeId}:ip:${ip}`;
    const count = await this.redis.client.incr(redisKey);
    if (count === 1) {
      await this.redis.client.expire(redisKey, windowSec);
    }

    if (count > max) {
      const ttl = await this.redis.client.ttl(redisKey);
      const retryAfter = ttl > 0 ? ttl : windowSec;
      res.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests from this address. Try again later.',
          retryAfterSeconds: retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  private limitsFor(routeId: RateLimitRouteId): { max: number; windowSec: number } {
    const def = DEFAULTS[routeId];
    const base = routeId.replace(/-/g, '_').toUpperCase();
    return {
      max: this.parsePositiveInt(`AUTH_RL_${base}_MAX`, def.max),
      windowSec: this.parsePositiveInt(`AUTH_RL_${base}_WINDOW_SEC`, def.windowSec),
    };
  }

  private parsePositiveInt(envKey: string, fallback: number): number {
    const raw = this.config.get<string>(envKey)?.trim();
    if (!raw) {
      return fallback;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
}
