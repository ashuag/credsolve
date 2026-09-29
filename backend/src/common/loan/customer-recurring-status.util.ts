import { LOAN_STATUS } from '../constants/loan.constants';
import { CUSTOMER_TYPE, type CustomerType } from '../constants/customer-type.constants';

/** customerId -> every lead id (across that customer's journeys) that owns a fully repaid (CLOSED) loan. */
export type ClosedLoanLeadIdsByCustomer = Map<bigint, Set<bigint>>;

export type CustomerRecurringStatusLookup = {
  loanAccount: {
    findMany: (args: {
      where: { closedAt: { not: null }; loanStatus: { name: string; isActive: boolean } };
      select: { customerId: true; application: { select: { leadId: true } } };
    }) => Promise<{ customerId: bigint; application: { leadId: bigint } }[]>;
  };
};

/**
 * Batch-loads, once per report/export run, every lead id that owns a fully repaid loan, grouped by
 * customer — the same "recurring customer" rule already used to lock identity fields and reuse
 * bureau data (see `recurring-customer-identity.util.ts`'s `findLatestPriorLeadDetailForCustomer`:
 * disbursed AND repaid; written-off, rejected, or still-open loans don't count). Loading it once for
 * the whole result set (instead of one query per row via that per-lead helper) is what keeps list
 * and export pages with many rows from paying an N+1 cost.
 */
export async function loadClosedLoanLeadIdsByCustomer(
  prisma: CustomerRecurringStatusLookup,
): Promise<ClosedLoanLeadIdsByCustomer> {
  const rows = await prisma.loanAccount.findMany({
    where: { closedAt: { not: null }, loanStatus: { name: LOAN_STATUS.CLOSED, isActive: true } },
    select: { customerId: true, application: { select: { leadId: true } } },
  });
  const map: ClosedLoanLeadIdsByCustomer = new Map();
  for (const row of rows) {
    const set = map.get(row.customerId);
    if (set) {
      set.add(row.application.leadId);
    } else {
      map.set(row.customerId, new Set([row.application.leadId]));
    }
  }
  return map;
}

/**
 * A customer is Recurring for a given row (lead/application/loan) if they have a fully repaid loan
 * under a *different* lead than this row's own — excluding the row's own lead so a customer's first
 * loan closing doesn't make that same lead's row read "Recurring".
 */
export function resolveCustomerType(
  closedLoanLeadIds: ClosedLoanLeadIdsByCustomer,
  customerId: bigint,
  ownLeadId: bigint,
): CustomerType {
  const leadIds = closedLoanLeadIds.get(customerId);
  if (!leadIds) return CUSTOMER_TYPE.NEW;
  const isRecurring = leadIds.size > 1 || !leadIds.has(ownLeadId);
  return isRecurring ? CUSTOMER_TYPE.RECURRING : CUSTOMER_TYPE.NEW;
}
