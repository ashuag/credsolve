/**
 * Mirrors Prisma enum `VendorHttpMethod` in `schema.prisma`.
 * Use Prisma’s generated enum after `npx prisma generate` where convenient.
 */
export type VendorHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export const VENDOR_HTTP_METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const satisfies Record<string, VendorHttpMethod>;
