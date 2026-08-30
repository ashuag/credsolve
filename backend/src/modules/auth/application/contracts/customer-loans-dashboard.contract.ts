export type CustomerLoanRepaymentLine = {
  /** ISO date (YYYY-MM-DD) */
  dueDate: string;
  label: string;
  amount: string;
  status: 'scheduled' | 'due' | 'overdue' | 'closed';
};

export type CustomerLoanCard = {
  applicationUuid: string;
  /** Public loan number (same as application number after disbursement). */
  loanNumber: string | null;
  /**
   * Display status for badges: loan account status when disbursed
   * (ACTIVE / OVERDUE / CLOSED / WRITTEN_OFF), else application status.
   */
  status: string;
  /** Principal. */
  loanAmount: string | null;
  tenureDays: number | null;
  /** Full-tenure interest (as of maturity / KFS). */
  interestAmount: string | null;
  /** Principal + full-tenure interest (amount due on maturity). */
  amountDueAtMaturity: string | null;
  /** Inclusive days from disbursement through today (disbursement day = day 1). */
  daysOutstanding: number | null;
  /** Interest charged if paid today (actual days inside cooling; full tenure after). */
  interestTillToday: string | null;
  /** Principal + interest due if paid today (actual days inside cooling; full tenure after). Includes penal charge when past due. */
  amountDueToday: string | null;
  /** True when pay-now interest is the contracted full tenure (cooling period has passed). */
  usedFullTenureInterest: boolean;
  /** Penal charge included in amountDueToday when repayment is past maturity (else `0.00` / null). */
  bounceFeeInr: string | null;
  /** Sum of successful `loan_repayment` rows. */
  totalPaidInr: string | null;
  /** Remaining to close today (`amountDueToday` after subtracting payments). */
  outstandingInr: string | null;
  processingFeeAmount: string | null;
  gstAmount: string | null;
  /**
   * @deprecated Prefer amountDueToday / amountDueAtMaturity.
   * Kept for older UI: open loans → amountDueToday; else amountDueAtMaturity.
   */
  totalRepayment: string | null;
  /** Repayment due / maturity date (YYYY-MM-DD). */
  maturityDate: string | null;
  disbursedAt: string | null;
  /** When the loan was closed / fully repaid (ISO datetime). */
  repaidAt: string | null;
  bankDisplay: string | null;
};

export type CustomerLoansDashboardResult = {
  /** Disbursed loans that are still open (including overdue / past maturity). */
  activeLoans: CustomerLoanCard[];
  pastLoans: CustomerLoanCard[];
  inProgress: CustomerLoanCard[];
  repaymentSchedule: CustomerLoanRepaymentLine[];
  /** `MIN_PAY_AMOUNT` setting — prefill for partial pay. */
  minPayAmountInr: string;
  /** True when a closed-window Pay Now was confirmed on this load. */
  reconciledPayment?: boolean;
  /** True when that reconcile closed the loan. */
  reconciledClosedLoan?: boolean;
};
