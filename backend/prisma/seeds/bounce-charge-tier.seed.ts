import type { Prisma } from '@prisma/client';

/**
 * Bounce fee schedule (excluding GST), matching the sanction letter / KFS grid.
 * maxAmountInr = null means open upper bound (≥ minAmountInr).
 */
const TIERS: Array<{
  minAmountInr: number;
  maxAmountInr: number | null;
  bounceFeeInr: number;
  sortOrder: number;
}> = [
  { minAmountInr: 0, maxAmountInr: 2_000, bounceFeeInr: 100, sortOrder: 1 },
  { minAmountInr: 2_001, maxAmountInr: 5_000, bounceFeeInr: 200, sortOrder: 2 },
  { minAmountInr: 5_001, maxAmountInr: 8_000, bounceFeeInr: 300, sortOrder: 3 },
  { minAmountInr: 8_001, maxAmountInr: 10_000, bounceFeeInr: 400, sortOrder: 4 },
  { minAmountInr: 10_001, maxAmountInr: null, bounceFeeInr: 500, sortOrder: 5 },
];

export async function seedBounceChargeTier(prisma: Prisma.TransactionClient) {
  await prisma.$transaction([
    prisma.bounceChargeTier.deleteMany({}),
    prisma.bounceChargeTier.createMany({
      data: TIERS.map((t) => ({
        minAmountInr: t.minAmountInr,
        maxAmountInr: t.maxAmountInr,
        bounceFeeInr: t.bounceFeeInr,
        sortOrder: t.sortOrder,
        isActive: true,
      })),
    }),
  ]);

  console.log('Bounce charge tiers seeded');
}
