export const LOAN_STATUS = {
  ACTIVE: 'ACTIVE',
  OVERDUE: 'OVERDUE',
  CLOSED: 'CLOSED',
  SETTLED: 'SETTLED',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const;

export type LoanStatusName = (typeof LOAN_STATUS)[keyof typeof LOAN_STATUS];

export function isClosedLoanStatus(name: string | null | undefined): boolean {
  const n = (name ?? '').toUpperCase();
  return n === LOAN_STATUS.CLOSED || n === LOAN_STATUS.SETTLED || n === LOAN_STATUS.WRITTEN_OFF;
}

/** Full payoff after a charge waiver is recorded as SETTLED instead of CLOSED. */
export function closeLoanStatusName(appliedWaiverInr: number): 'CLOSED' | 'SETTLED' {
  return appliedWaiverInr > 0.009 ? LOAN_STATUS.SETTLED : LOAN_STATUS.CLOSED;
}
