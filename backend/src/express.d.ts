import { type CustomerJwtPayload } from './modules/auth/services/customer-auth.service';

declare module 'express' {
  export interface Request {
    losUser?: unknown;
    customerUser?: CustomerJwtPayload;
    cookies?: Record<string, string>;
    headers: {
      authorization?: string;
      [key: string]: string | string[] | undefined;
    };
  }
}
