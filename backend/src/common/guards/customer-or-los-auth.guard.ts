import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CustomerSessionService } from '../../modules/auth/infrastructure/session/customer-session.service';
import { LosSessionService } from '../../modules/los/auth/los-session.service';

/**
 * Allows either a valid LOS bearer session or a valid customer cookie session.
 * Sets `req.losUser` when LOS wins; otherwise attaches `req.customerSession`.
 */
@Injectable()
export class CustomerOrLosAuthGuard implements CanActivate {
  constructor(
    private readonly losSession: LosSessionService,
    private readonly customerSessions: CustomerSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const authHeader = req.header('authorization') ?? '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme?.toLowerCase() === 'bearer' && token) {
      const los = await this.losSession.getSession(token);
      if (los) {
        req.losUser = los;
        return true;
      }
    }

    await this.customerSessions.attachCustomerSession(req, res);
    if (req.customerSession) {
      return true;
    }

    throw new UnauthorizedException('Sign in with LOS token or customer OTP session.');
  }
}
