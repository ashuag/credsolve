import type { Prisma } from '@prisma/client';

// Eligibility Basis – Unsecured Loan Credit Limit
// maxUnsecuredLoan = null means "no upper bound" (≥ minUnsecuredLoan)
const TIERS: Array<{ minUnsecuredLoan: number; maxUnsecuredLoan: number | null; maxBulletLoan: number; sortOrder: number }> = [
  { minUnsecuredLoan:   20_000, maxUnsecuredLoan:   49_999, maxBulletLoan:  2_000, sortOrder: 1 },
  { minUnsecuredLoan:   50_000, maxUnsecuredLoan:  199_999, maxBulletLoan:  4_000, sortOrder: 2 },
  { minUnsecuredLoan:  200_000, maxUnsecuredLoan:  399_999, maxBulletLoan:  6_000, sortOrder: 3 },
  { minUnsecuredLoan:  400_000, maxUnsecuredLoan:  599_999, maxBulletLoan:  8_000, sortOrder: 4 },
  { minUnsecuredLoan:  600_000, maxUnsecuredLoan:  799_999, maxBulletLoan: 10_000, sortOrder: 5 },
  { minUnsecuredLoan:  800_000, maxUnsecuredLoan:  999_999, maxBulletLoan: 12_000, sortOrder: 6 },
  { minUnsecuredLoan: 1_000_000, maxUnsecuredLoan: 1_499_999, maxBulletLoan: 15_000, sortOrder: 7 },
  { minUnsecuredLoan: 1_500_000, maxUnsecuredLoan: 1_799_999, maxBulletLoan: 20_000, sortOrder: 8 },
  { minUnsecuredLoan: 1_800_000, maxUnsecuredLoan: 1_999_999, maxBulletLoan: 25_000, sortOrder: 9 },
  { minUnsecuredLoan: 2_000_000, maxUnsecuredLoan: null,       maxBulletLoan: 30_000, sortOrder: 10 },
];

export async function seedCreditLimitTier(prisma: Prisma.TransactionClient) {
  // Clear and re-insert to stay idempotent
  await prisma.$executeRaw`DELETE FROM \`credit_limit_tier\``;

  for (const t of TIERS) {
    await prisma.$executeRaw`
      INSERT INTO \`credit_limit_tier\`
        (min_unsecured_loan, max_unsecured_loan, max_bullet_loan, sort_order, is_active, updated_at)
      VALUES
        (${t.minUnsecuredLoan}, ${t.maxUnsecuredLoan}, ${t.maxBulletLoan}, ${t.sortOrder}, 1, NOW(3))
    `;
  }

  console.log('Credit limit tiers seeded');
}
