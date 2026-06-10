import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { LosSessionService, type LosSessionPayload } from './los-session.service';

type RequestWithLosUser = Request & { losUser?: LosSessionPayload };

@Injectable()
export class LosAuthGuard implements CanActivate {
  constructor(private readonly losSession: LosSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithLosUser>();
    const authHeader = req.header('authorization') ?? '';
    const [scheme, bearer] = authHeader.split(' ');
    const queryToken = req.query.access_token;
    const token =
      scheme?.toLowerCase() === 'bearer' && bearer
        ? bearer
        : req.method === 'GET' && typeof queryToken === 'string' && queryToken.trim()
          ? queryToken.trim()
          : '';

    if (!token) {
      throw new UnauthorizedException('Missing LOS bearer token');
    }

    const session = await this.losSession.getSession(token);
    if (!session) {
      throw new UnauthorizedException('LOS session expired');
    }

    req.losUser = session;
    return true;
  }
}
