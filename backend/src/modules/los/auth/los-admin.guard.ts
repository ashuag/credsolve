import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { isLosAdminRole } from './los-role.util';
import type { LosSessionPayload } from './los-session.service';

type RequestWithLosUser = Request & { losUser?: LosSessionPayload };

@Injectable()
export class LosAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithLosUser>();
    const roleName = req.losUser?.roleName ?? null;
    const hierarchyLevel = req.losUser?.hierarchyLevel ?? null;
    if (!isLosAdminRole(roleName, hierarchyLevel)) {
      throw new ForbiddenException('Only the Admin role can reapply a rejected customer journey.');
    }
    return true;
  }
}
