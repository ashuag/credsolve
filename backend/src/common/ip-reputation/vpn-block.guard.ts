import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RATE_LIMIT_ROUTE_KEY, type RateLimitRouteId } from '../rate-limit/rate-limit-route.decorator';
import { VPN_BLOCK_MESSAGE, VPN_DETECTED_ERROR_CODE } from './ip-reputation.constants';
import { IpReputationService } from './ip-reputation.service';

function clientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]?.trim();
  }
  return req.ip;
}

/**
 * Blocks requests from VPN/proxy IPs on the sensitive customer-journey endpoints.
 * Acts only on handlers already marked with `@RateLimitByRoute(...)` so it covers
 * every rate-limited step (send-otp, verify-otp, verify-pan, digilocker, bank, kyc, ...)
 * and never touches image/redirect routes. No-op unless `VPN_DETECTION_ENABLED` is set.
 */
@Injectable()
export class VpnBlockGuard implements CanActivate {
  private readonly logger = new Logger(VpnBlockGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly ipReputation: IpReputationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.ipReputation.enabled) {
      return true;
    }

    const routeId = this.reflector.get<RateLimitRouteId | undefined>(
      RATE_LIMIT_ROUTE_KEY,
      context.getHandler(),
    );
    if (!routeId) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const ip = clientIp(req);
    const verdict = await this.ipReputation.classify(ip);

    if (verdict.isVpnOrProxy) {
      this.logger.warn(`Blocked VPN/proxy IP=${ip ?? 'unknown'} route=${routeId} (${verdict.reason ?? ''})`);
      throw new ForbiddenException({
        statusCode: 403,
        code: VPN_DETECTED_ERROR_CODE,
        message: VPN_BLOCK_MESSAGE,
      });
    }

    return true;
  }
}
