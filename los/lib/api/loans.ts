import { authorizedLosRequest, cachedAuthorizedLosGet } from './_shared';

export type LosLoan = {
  uuid: string;
  loanNumber: string;
  loanAccountNumber: string;
  applicationUuid: string;
  applicationNumber: string;
  customerUuid: string;
  leadUuid: string;
  fullName: string | null;
  mobileNumber: string;
  email: string | null;
  principalAmount: string;
  netDisbursedAmount: string;
  interestRate: string;
  interestAmount: string;
  totalRepaymentAmount: string;
  processingFeeAmount: string | null;
  gstAmount: string | null;
  disbursedAt: string;
  loanMaturityDate: string;
  utr: string | null;
  bankName: string | null;
  bankAccountMasked: string | null;
  ifscCode: string | null;
  loanStatusCode: string;
  loanStatusLabel: string;
  applicationStatusCode: string;
  applicationStatusLabel: string;
  closedAt: string | null;
};

export type LosLoanDetails = LosLoan & {
  panNumber: string | null;
  address: string | null;
  purposeOfLoan: string | null;
  expectedRepaymentDays: number | null;
  daysToMaturity: number;
  bankAccountNumber: string | null;
  loanDocumentsAcceptedAt: string | null;
  keyFactReady: boolean;
  totalPaidAmount: string;
  outstandingAmount: string;
  isDisbursedApplication: boolean;
  repayments: Array<{
    uuid: string;
    amount: string;
    paymentMode: string;
    status: 'SUCCESS' | 'FAILED';
    utr: string | null;
    failureMessage: string | null;
    paidAt: string;
    createdAt: string;
  }>;
};

export async function getLoans(token: string): Promise<LosLoan[]> {
  return cachedAuthorizedLosGet<LosLoan[]>(token, '/loans', 'Failed to fetch loans');
}

export async function getLoanDetails(token: string, loanUuid: string): Promise<LosLoanDetails> {
  return authorizedLosRequest<LosLoanDetails>(
    token,
    `/loans/${encodeURIComponent(loanUuid)}`,
    { method: 'GET' },
    'Failed to fetch loan details.',
  );
}
