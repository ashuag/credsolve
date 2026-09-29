import { cachedAuthorizedLosGet, downloadAuthenticatedWorkbook } from './_shared';

export type LosLeadReportListItem = {
  uuid: string;
  leadNumber: string;
  customerUuid: string;
  fullName: string | null;
  panCardName: string | null;
  mobileNumber: string;
  email: string | null;
  dateOfBirth: string | null;
  panNumber: string | null;
  gender: string | null;
  occupation: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  address: string | null;
  netMonthlyIncome: string | null;
  cibilScore: number | null;
  /** CIBIL credit-assessment grade (A–H) from the current bureau report. */
  cibilCreditAssessmentCategory: string | null;
<<<<<<< HEAD
=======
  /** 'NEW' (no prior repaid loan) or 'RECURRING' (has a fully repaid loan under a different lead). */
  customerType: 'NEW' | 'RECURRING';
  customerTypeLabel: string;
>>>>>>> refs/remotes/moneycash/main
  leadStatusCode: string;
  leadStatusLabel: string;
  rejectionReasonCode: string | null;
  rejectionReasonLabel: string | null;
  rejectionNote: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  applicationUuid: string | null;
  applicationNumber: string | null;
  applicationStatusCode: string | null;
  applicationStatusLabel: string | null;
  purposeOfLoan: string | null;
  loanOfferAmount: string | null;
  loanSelectedAmount: string | null;
  interestRate: string | null;
  processingFeePercent: string | null;
  processingFeeAmount: string | null;
  gstPercent: string | null;
  gstAmount: string | null;
  expectedRepaymentDays: number | null;
  expectedRepaymentDate: string | null;
  repaymentAmount: string | null;
  loanUuid: string | null;
  loanNumber: string | null;
  loanStatusCode: string | null;
  loanStatusLabel: string | null;
  principalAmount: string | null;
  netDisbursedAmount: string | null;
  interestAmount: string | null;
  totalRepaymentAmount: string | null;
  disbursedAt: string | null;
  loanMaturityDate: string | null;
  repaymentStatusCode: string;
  repaymentStatusLabel: string;
  latestRepaymentAmount: string | null;
  latestRepaymentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LosLeadReportDetails = LosLeadReportListItem;

export async function getLeadReports(token: string): Promise<LosLeadReportListItem[]> {
  return cachedAuthorizedLosGet<LosLeadReportListItem[]>(
    token,
    '/lead-reports',
    'Failed to load lead reports',
  );
}

export async function getLeadReportDetails(token: string, leadUuid: string): Promise<LosLeadReportDetails> {
  return cachedAuthorizedLosGet<LosLeadReportDetails>(
    token,
    `/lead-reports/${encodeURIComponent(leadUuid)}`,
    'Failed to load lead report',
  );
}

/**
 * Authenticated workbook download — uses the Bearer header, not a query token. Caller must pass the
 * table's active column filters (same keys as the Lead Report table's columns) — the backend
 * rejects an empty set.
 */
export async function downloadLeadReportsExport(
  token: string,
  filters: Partial<Record<string, string>>,
): Promise<void> {
  return downloadAuthenticatedWorkbook({
    token,
    path: '/lead-reports/export',
    filters,
    timeoutMessage: 'Download timed out while building the lead report. Please try again.',
    fallbackErrorMessage: 'Failed to download lead report',
    fallbackFilename: 'Lead report.xlsx',
  });
}
