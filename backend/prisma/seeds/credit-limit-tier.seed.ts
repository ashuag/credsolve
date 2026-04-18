import type { Prisma } from '@prisma/client';

// Eligibility Basis – Unsecured Loan Credit Limit
// maxUnsecuredLoan = null means "no upper bound" (≥ minUnsecuredLoan)
const TIERS: Array<{ minUnsecuredLoan: number; maxUnsecuredLoan: number | null; maxBulletLoan: number; sortOrder: number }> = [
  { minUnsecuredLoan: 20_000, maxUnsecuredLoan: 49_999, maxBulletLoan: 2_000, sortOrder: 1 },
  { minUnsecuredLoan: 50_000, maxUnsecuredLoan: 199_999, maxBulletLoan: 4_000, sortOrder: 2 },
  { minUnsecuredLoan: 200_000, maxUnsecuredLoan: 399_999, maxBulletLoan: 6_000, sortOrder: 3 },
  { minUnsecuredLoan: 400_000, maxUnsecuredLoan: 599_999, maxBulletLoan: 8_000, sortOrder: 4 },
  { minUnsecuredLoan: 600_000, maxUnsecuredLoan: 799_999, maxBulletLoan: 10_000, sortOrder: 5 },
  { minUnsecuredLoan: 800_000, maxUnsecuredLoan: 999_999, maxBulletLoan: 12_000, sortOrder: 6 },
  { minUnsecuredLoan: 1_000_000, maxUnsecuredLoan: 1_499_999, maxBulletLoan: 15_000, sortOrder: 7 },
  { minUnsecuredLoan: 1_500_000, maxUnsecuredLoan: 1_799_999, maxBulletLoan: 20_000, sortOrder: 8 },
  { minUnsecuredLoan: 1_800_000, maxUnsecuredLoan: 1_999_999, maxBulletLoan: 25_000, sortOrder: 9 },
  { minUnsecuredLoan: 2_000_000, maxUnsecuredLoan: null, maxBulletLoan: 30_000, sortOrder: 10 },
];

export async function seedCreditLimitTier(prisma: Prisma.TransactionClient) {
  await prisma.$transaction([
    prisma.creditLimitTier.deleteMany({}),
    prisma.creditLimitTier.createMany({
      data: TIERS.map((t) => ({
        minUnsecuredLoan: t.minUnsecuredLoan,
        maxUnsecuredLoan: t.maxUnsecuredLoan,
        maxBulletLoan: t.maxBulletLoan,
        sortOrder: t.sortOrder,
        isActive: true,
      })),
    }),
  ]);

  console.log('Credit limit tiers seeded');
}
