import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_ROUTE_KEY = 'rate_limit_route';

export type RateLimitRouteId =
  | 'send-otp'
  | 'verify-otp'
  | 'verify-pan'
  | 'digilocker-init'
  | 'digilocker-aadhaar'
  | 'fetch-bureau'
  | 'logout'
  | 'sync-lead-email'
  | 'save-lead-details'
  | 'save-lead-references'
  | 'professional-details'
  | 'loan-selection'
  | 'kyc-documents'
  | 'bank-details'
  | 'bank-ifsc-lookup'
  | 'bank-submit-verified'
  | 'kyc-selfie'
  | 'kyc-liveness'
  | 'loan-documents'
  | 'loan-documents-otp';

/** Marks a handler for Redis fixed-window rate limiting by client IP (see RedisIpRateLimitGuard). */
export const RateLimitByRoute = (id: RateLimitRouteId) => SetMetadata(RATE_LIMIT_ROUTE_KEY, id);
