import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { type CustomerJwtPayload } from '../services/customer-auth.service';

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerJwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.customerUser!;
  }
);
