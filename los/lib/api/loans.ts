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
  /** Unused for overdue charges (penal % applies instead); kept for API compatibility. */
  bounceRatePerDayInr: string;
  /** Penal charge (rate % of principal, min/max capped); "0.00" unless past due. */
  penalAmount: string;
  /** `totalRepaymentAmount` plus the penal charge. */
  totalRepaymentWithPenalAmount: string;
  /** IST calendar days past maturity; 0 when not overdue. */
  overdueDays: number;
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
  /** Pay Now link was initiated and is not yet recorded as a SUCCESS repayment. */
  unsettledPaymentLink: boolean;
};

export type LosLoanDisbursementTransfer = {
  id: string | null;
  uniqueRequestNumber: string | null;
  uniqueTransactionReference: string | null;
  status: string | null;
  paymentMode: string | null;
  amount: string | null;
  currency: string | null;
  narration: string | null;
  failureReason: string | null;
  serviceCharge: string | null;
  gstAmount: string | null;
  serviceChargeWithGst: string | null;
  beneficiaryAccountName: string | null;
  beneficiaryAccountNumber: string | null;
  beneficiaryAccountIfsc: string | null;
  beneficiaryBankName: string | null;
  sourceVirtualAccount: string | null;
  transferDate: string | null;
  successAt: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
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
  /** Processing fee % saved on the application at selection. */
  processingFeePercentage: string | null;
  /** GST % on processing fee saved on the application. */
  gstPercentage: string | null;
  /** Inclusive days from disbursement through today (or closedAt if closed). */
  daysOutstanding: number | null;
  /** Interest charged if paid today (actual days inside cooling; full tenure after). */
  interestTillToday: string | null;
  /** Principal + interest due today. */
  amountDueToday: string | null;
  /** True when pay-now interest is the contracted full tenure (cooling period has passed). */
  usedFullTenureInterest: boolean;
  bounceFeeInr: string | null;
  isDisbursedApplication: boolean;
  disbursementTransfer: LosLoanDisbursementTransfer | null;
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

export type LosRefreshPaymentResult = {
  outcome:
    | 'already_closed'
    | 'no_payment_link'
    | 'updated'
    | 'pending'
    | 'not_paid'
    | 'retrieve_failed';
  message: string;
  loanClosed: boolean;
  closedAt: string | null;
  loanStatusCode: string;
  loanStatusLabel: string;
  unsettledPaymentLink: boolean;
};

export async function refreshLoanPayment(
  token: string,
  loanUuid: string,
): Promise<LosRefreshPaymentResult> {
  return authorizedLosRequest<LosRefreshPaymentResult>(
    token,
    `/loans/${encodeURIComponent(loanUuid)}/refresh-payment`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    'Failed to refresh payment status.',
    90_000,
  );
}
