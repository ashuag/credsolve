import { apiGet } from './client';

export type CustomerLoanRepaymentLine = {
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

export type CustomerLoansDashboard = {
  activeLoans: CustomerLoanCard[];
  pastLoans: CustomerLoanCard[];
  inProgress: CustomerLoanCard[];
  repaymentSchedule: CustomerLoanRepaymentLine[];
};

export async function fetchCustomerLoansDashboard(): Promise<CustomerLoansDashboard | null> {
  return apiGet<CustomerLoansDashboard>('/auth/my-loans', 'Unable to load your loans.');
}
