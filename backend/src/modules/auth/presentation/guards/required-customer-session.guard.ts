import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CustomerSessionService } from '../../infrastructure/session/customer-session.service';

/**
 * Ensures a valid Redis-backed customer session (same attach semantics as optional guard).
 * Rejects with 401 when the user is not authenticated.
 */
@Injectable()
export class RequiredCustomerSessionGuard implements CanActivate {
  constructor(private readonly customerSessions: CustomerSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    // Skip re-attach when OptionalCustomerSessionGuard (or another guard) already bound the session.
    // Re-attaching with rotate-on-use would delete the Redis key mid-request and cause a spurious 401.
    if (!req.customerSession) {
      await this.customerSessions.attachCustomerSession(req, res);
    }
    if (!req.customerSession) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }
    return true;
  }
}
