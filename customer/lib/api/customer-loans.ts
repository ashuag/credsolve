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
  overdueDays?: number | null;
  overdueInterestInr?: string | null;
  waivedAmountInr?: string | null;
  bounceFeeInr: string | null;
  totalPaidInr: string | null;
  outstandingInr: string | null;
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
  minPayAmountInr: string;
  reconciledPayment?: boolean;
  reconciledClosedLoan?: boolean;
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
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
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
  amountInr?: number,
): Promise<InitiateRepaymentResult | null> {
  return apiPost<InitiateRepaymentResult>(
    `/auth/my-loans/${encodeURIComponent(applicationUuid)}/repay`,
    amountInr != null ? { amountInr } : {},
    'Unable to start repayment right now.',
  );
}

export async function fetchCustomerPaymentHistory(): Promise<CustomerPaymentHistory | null> {
  return apiGet<CustomerPaymentHistory>('/auth/my-payments', 'Unable to load payment history.');
}

export type CustomerRefreshPaymentResult = {
  outcome:
    | 'already_closed'
    | 'no_payment_link'
    | 'updated'
    | 'pending'
    | 'not_paid'
    | 'retrieve_failed';
  message: string;
  loanClosed: boolean;
};

const REPAY_PENDING_APP_KEY = 'mc_repay_pending_app';

export function markRepaymentPending(applicationUuid: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(REPAY_PENDING_APP_KEY, applicationUuid);
}

export function takeRepaymentPendingApplication(): string | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(REPAY_PENDING_APP_KEY)?.trim() || null;
  if (value) window.sessionStorage.removeItem(REPAY_PENDING_APP_KEY);
  return value;
}

export async function refreshCustomerRepayment(
  applicationUuid: string,
): Promise<CustomerRefreshPaymentResult | null> {
  return apiPost<CustomerRefreshPaymentResult>(
    `/auth/my-loans/${encodeURIComponent(applicationUuid)}/refresh-payment`,
    {},
    'Unable to refresh payment status.',
    { timeoutMs: 60_000 },
  );
}
