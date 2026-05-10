export type CustomerLoanRepaymentLine = {
  /** ISO date (YYYY-MM-DD) */
  dueDate: string;
  label: string;
  amount: string;
  status: 'scheduled' | 'due' | 'overdue' | 'closed';
};

export type CustomerLoanCard = {
  applicationUuid: string;
  status: string;
  loanAmount: string | null;
  tenureDays: number | null;
  interestAmount: string | null;
  processingFeeAmount: string | null;
  gstAmount: string | null;
  totalRepayment: string | null;
  maturityDate: string | null;
  disbursedAt: string | null;
  bankDisplay: string | null;
};

export type CustomerLoansDashboardResult = {
  /** Disbursed loans whose maturity date is today or later (short-term bullet loans). */
  activeLoans: CustomerLoanCard[];
  pastLoans: CustomerLoanCard[];
  inProgress: CustomerLoanCard[];
  repaymentSchedule: CustomerLoanRepaymentLine[];
};
