export const LOAN_REPAYMENT_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

export type LoanRepaymentStatusName =
  (typeof LOAN_REPAYMENT_STATUS)[keyof typeof LOAN_REPAYMENT_STATUS];
