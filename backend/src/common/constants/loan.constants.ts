export const LOAN_STATUS = {
  ACTIVE: 'ACTIVE',
  OVERDUE: 'OVERDUE',
  CLOSED: 'CLOSED',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const;

export type LoanStatusName = (typeof LOAN_STATUS)[keyof typeof LOAN_STATUS];
