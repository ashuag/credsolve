export const LOAN_REPAYMENT_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
} as const;

export type LoanRepaymentStatusName =
  (typeof LOAN_REPAYMENT_STATUS)[keyof typeof LOAN_REPAYMENT_STATUS];

/** Money was collected (full payoff or installment). Failed attempts are excluded. */
export const COLLECTED_REPAYMENT_STATUSES: Array<'SUCCESS' | 'PARTIAL'> = [
  LOAN_REPAYMENT_STATUS.SUCCESS,
  LOAN_REPAYMENT_STATUS.PARTIAL,
];

export function isCollectedRepaymentStatus(status: string | null | undefined): boolean {
  return status === LOAN_REPAYMENT_STATUS.SUCCESS || status === LOAN_REPAYMENT_STATUS.PARTIAL;
}
