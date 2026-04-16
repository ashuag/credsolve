import type { Prisma } from '@prisma/client';
import { LoanReason } from '../../src/common/constants/loanReason.constants';

export async function seedLoanReason(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(LoanReason)) {
    await prisma.$executeRaw`
      INSERT INTO \`reason_for_loan\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
  }

  console.log('Reason for Loan seeded');
}
