import type { Prisma } from '@prisma/client';
import { LoanReason } from '../../src/common/constants/loanReason.constants';

export async function seedLoanReason(prisma: Prisma.TransactionClient) {
  for (const name of Object.values(LoanReason)) {
    await prisma.reasonForLoan.upsert({
      where: { name },
      create: { name, isActive: true },
      update: { isActive: true },
    });
  }

  console.log('Reason for Loan seeded');
}
