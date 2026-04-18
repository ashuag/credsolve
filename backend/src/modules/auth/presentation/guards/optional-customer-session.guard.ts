import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CustomerSessionService } from '../../infrastructure/session/customer-session.service';

/**
 * Validates the opaque session cookie against Redis (sliding / optional rotation).
 * Attaches {@link Request.customerSession} when valid; never rejects the request.
 */
@Injectable()
export class OptionalCustomerSessionGuard implements CanActivate {
  constructor(private readonly customerSessions: CustomerSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    await this.customerSessions.attachCustomerSession(req, res);
    return true;
  }
}
