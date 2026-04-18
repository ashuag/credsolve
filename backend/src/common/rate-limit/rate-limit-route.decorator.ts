import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_ROUTE_KEY = 'rate_limit_route';

export type RateLimitRouteId =
  | 'send-otp'
  | 'verify-otp'
  | 'logout'
  | 'sync-lead-email'
  | 'save-lead-details'
  | 'professional-details';

/** Marks a handler for Redis fixed-window rate limiting by client IP (see RedisIpRateLimitGuard). */
export const RateLimitByRoute = (id: RateLimitRouteId) => SetMetadata(RATE_LIMIT_ROUTE_KEY, id);
