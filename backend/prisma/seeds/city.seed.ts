import type { Prisma } from '@prisma/client';

/** @deprecated Use `node scripts/import-geography-bulk.mjs` — too slow for ~1k cities + ~20k pincodes. */
export async function seedCity(_prisma: Prisma.TransactionClient) {
  console.log('City seed skipped — run scripts/import-geography-bulk.mjs after state seed.');
}
