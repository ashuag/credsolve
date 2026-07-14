import { LOAN_STATUS } from '../constants/loan.constants';

/** Loan statuses that block starting another application. */
export const OPEN_LOAN_STATUS_NAMES = [LOAN_STATUS.ACTIVE, LOAN_STATUS.OVERDUE] as const;

type LoanAccountDb = {
  loanAccount: {
    findFirst(args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
    }): Promise<Record<string, unknown> | null>;
  };
};

/**
 * True when the customer has a disbursed loan still ACTIVE or OVERDUE
 * (not CLOSED / WRITTEN_OFF). Blocks a further loan application.
 */
export async function customerHasOpenLoan(
  prisma: LoanAccountDb,
  customerId: bigint,
): Promise<boolean> {
  const open = await prisma.loanAccount.findFirst({
    where: {
      customerId,
      closedAt: null,
      loanStatus: { name: { in: [...OPEN_LOAN_STATUS_NAMES] }, isActive: true },
    },
    select: { id: true },
  });
  return Boolean(open);
}

/**
 * True when this lead has an ACTIVE/OVERDUE loan account.
 */
export async function leadHasOpenLoan(
  prisma: LoanAccountDb,
  leadId: bigint,
): Promise<boolean> {
  const open = await prisma.loanAccount.findFirst({
    where: {
      application: { leadId },
      closedAt: null,
      loanStatus: { name: { in: [...OPEN_LOAN_STATUS_NAMES] }, isActive: true },
    },
    select: { id: true },
  });
  return Boolean(open);
}

/**
 * Latest lead id (active or inactive) that owns an open loan for this customer.
 * Used to keep / restore the CONVERTED lead after disbursement.
 */
export async function findLeadIdWithOpenLoanForCustomer(
  prisma: LoanAccountDb,
  customerId: bigint,
): Promise<bigint | null> {
  const open = await prisma.loanAccount.findFirst({
    where: {
      customerId,
      closedAt: null,
      loanStatus: { name: { in: [...OPEN_LOAN_STATUS_NAMES] }, isActive: true },
    },
    orderBy: { disbursedAt: 'desc' },
    select: {
      application: { select: { leadId: true } },
    },
  });
  const leadId = (open as { application?: { leadId?: bigint } } | null)?.application?.leadId;
  return leadId ?? null;
}

/**
 * CONVERTED leads may be deactivated for reapply only after their loan is settled
 * (CLOSED / WRITTEN_OFF) — never merely because the loan was disbursed.
 */
export async function canDeactivateConvertedLeadForReapply(
  prisma: LoanAccountDb,
  leadId: bigint,
): Promise<boolean> {
  if (await leadHasOpenLoan(prisma, leadId)) {
    return false;
  }
  const settledLoan = await prisma.loanAccount.findFirst({
    where: {
      application: { leadId },
      OR: [
        { closedAt: { not: null } },
        { loanStatus: { name: { in: [LOAN_STATUS.CLOSED, LOAN_STATUS.WRITTEN_OFF] } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(settledLoan);
}
