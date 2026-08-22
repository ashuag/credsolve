import { apiGet, apiPost } from './client';

export type CustomerLoanRepaymentLine = {
  dueDate: string;
  label: string;
  amount: string;
  status: 'scheduled' | 'due' | 'overdue' | 'closed';
};

export type CustomerLoanCard = {
  applicationUuid: string;
  loanNumber: string | null;
  status: string;
  loanAmount: string | null;
  tenureDays: number | null;
  interestAmount: string | null;
  amountDueAtMaturity: string | null;
  daysOutstanding: number | null;
  interestTillToday: string | null;
  amountDueToday: string | null;
  usedFullTenureInterest?: boolean;
  bounceFeeInr: string | null;
  processingFeeAmount: string | null;
  gstAmount: string | null;
  totalRepayment: string | null;
  maturityDate: string | null;
  disbursedAt: string | null;
  repaidAt: string | null;
  bankDisplay: string | null;
};

export type CustomerLoansDashboard = {
  activeLoans: CustomerLoanCard[];
  pastLoans: CustomerLoanCard[];
  inProgress: CustomerLoanCard[];
  repaymentSchedule: CustomerLoanRepaymentLine[];
};

export type InitiateRepaymentResult = {
  success: true;
  applicationUuid: string;
  loanAccountUuid: string;
  loanNumber: string;
  amountInr: string;
  bounceFeeInr: string;
  repaymentUuid: string | null;
  loanStatus: string;
  redirectPath: string;
  /** Easebuzz hosted payout / payment URL — open this to complete Pay Now. */
  paymentUrl: string | null;
  vendor: 'easebuzz' | 'skipped';
};

export type CustomerPaymentHistoryItem = {
  uuid: string;
  loanAccountUuid: string;
  loanNumber: string;
  amount: string;
  paymentMode: string;
  status: 'SUCCESS' | 'FAILED';
  utr: string | null;
  failureMessage: string | null;
  paidAt: string;
};

export type CustomerPaymentHistory = {
  payments: CustomerPaymentHistoryItem[];
};

export async function fetchCustomerLoansDashboard(): Promise<CustomerLoansDashboard | null> {
  return apiGet<CustomerLoansDashboard>('/auth/my-loans', 'Unable to load your loans.');
}

export async function initiateCustomerRepayment(
  applicationUuid: string,
): Promise<InitiateRepaymentResult | null> {
  return apiPost<InitiateRepaymentResult>(
    `/auth/my-loans/${encodeURIComponent(applicationUuid)}/repay`,
    {},
    'Unable to start repayment right now.',
  );
}

export async function fetchCustomerPaymentHistory(): Promise<CustomerPaymentHistory | null> {
  return apiGet<CustomerPaymentHistory>('/auth/my-payments', 'Unable to load payment history.');
}
