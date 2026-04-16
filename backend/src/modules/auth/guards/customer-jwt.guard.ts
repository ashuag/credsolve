import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomerAuthService } from '../services/customer-auth.service';

@Injectable()
export class CustomerJwtGuard implements CanActivate {
  constructor(
    private readonly customerAuthService: CustomerAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const auth = await this.customerAuthService.authenticateRequest(request);

    if (!auth.authenticated && auth.reason !== 'invalid_token') {
      throw new UnauthorizedException('Missing authorization token');
    }

    if (!auth.authenticated) {
      this.customerAuthService.clearAuthCookie(response);
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.customerUser = auth.customer;
    return true;
  }
}
