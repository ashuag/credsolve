import type { Prisma } from '@prisma/client';

const LOAN_STATUSES = [
  { name: 'ACTIVE', displayName: 'Active' },
  { name: 'OVERDUE', displayName: 'Overdue' },
  { name: 'CLOSED', displayName: 'Closed' },
  { name: 'WRITTEN_OFF', displayName: 'Written off' },
] as const;

type LoanStatusSeedClient = {
  loanStatus: {
    upsert(args: {
      where: { name: string };
      create: { name: string; displayName: string; isActive: boolean };
      update: { displayName: string; isActive: boolean };
    }): Prisma.PrismaPromise<unknown>;
  };
};

export async function seedLoanStatus(prisma: LoanStatusSeedClient): Promise<void> {
  for (const row of LOAN_STATUSES) {
    await prisma.loanStatus.upsert({
      where: { name: row.name },
      create: { name: row.name, displayName: row.displayName, isActive: true },
      update: { displayName: row.displayName, isActive: true },
    });
  }
}
