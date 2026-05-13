import { Prisma } from '@prisma/client';

/** Parse optional INR amount strings (digits only after stripping separators). */
export function parseOptionalInrAmount(raw: string | undefined | null): Prisma.Decimal | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  return new Prisma.Decimal(digits);
}
