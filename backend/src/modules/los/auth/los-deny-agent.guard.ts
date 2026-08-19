import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { isLosAgentRole } from './los-role.util';
import type { LosSessionPayload } from './los-session.service';

type RequestWithLosUser = Request & { losUser?: LosSessionPayload };

function roleFromRequest(req: RequestWithLosUser) {
  return {
    roleName: req.losUser?.roleName ?? null,
    hierarchyLevel: req.losUser?.hierarchyLevel ?? null,
  };
}

function forbidAgent(): never {
  throw new ForbiddenException('This module is not available for the Agent role.');
}

/** Blocks the Agent role from the entire route (read and write). */
@Injectable()
export class LosDenyAgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithLosUser>();
    const { roleName, hierarchyLevel } = roleFromRequest(req);
    if (isLosAgentRole(roleName, hierarchyLevel)) forbidAgent();
    return true;
  }
}

/** Blocks the Agent role from POST/PATCH/DELETE while leaving GET available. */
@Injectable()
export class LosDenyAgentWritesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithLosUser>();
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
    const { roleName, hierarchyLevel } = roleFromRequest(req);
    if (isLosAgentRole(roleName, hierarchyLevel)) forbidAgent();
    return true;
  }
}
