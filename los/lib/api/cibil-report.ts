import { cachedAuthorizedLosGet } from './_shared';

export type CibilReportPaymentMonth = {
  year: number;
  month: number;
  status: string;
};

export type CibilReportAccountRow = {
  creditor: string;
  accountNumber: string;
  accountType: string;
  ownership: string;
  dateOpened: string | null;
  dateReported: string | null;
  dateClosed: string | null;
  dateLastPayment: string | null;
  paymentStartDate: string | null;
  paymentEndDate: string | null;
  sanctionedAmount: string;
  rateOfInterest: string;
  emiAmount: string;
  currentBalance: string;
  repaymentTenure: string;
  paymentFrequency: string;
  overdueAmount: string;
  cashLimit: string;
  highBalance: string;
  writtenOffTotal: string;
  writtenOffPrincipal: string;
  settlementAmount: string;
  collateralValue: string;
  collateralType: string;
  suitFiled: string;
  status: string;
  paymentHistory: CibilReportPaymentMonth[];
};

export type CibilReportInquiryRow = {
  date: string;
  member: string;
  purpose: string;
  amount: string;
};

export type CibilReportAddressRow = {
  category: string;
  address: string;
  pincode: string;
  dateReported: string | null;
};

export type CibilReportPhoneRow = {
  type: string;
  number: string;
};

export type CibilReportIdentifierRow = {
  type: string;
  number: string;
};

export type CibilReportScoreFactor = {
  code: string;
  text: string;
};

export type CibilReportAccountOverviewRow = {
  creditor: string;
  accountType: string;
  status: string;
  exposureInr: number;
  exposureLabel: string;
  isUnsecured: boolean;
};

export type CibilReportExposureInsight = {
  maxOpenUnsecuredExposureInr: number;
  drivingCreditor: string | null;
  drivingAccountType: string | null;
};

export type CibilReportPreApprovedInsight = {
  tierId: number | null;
  tierBandLabel: string | null;
  maxBulletLoan: number | null;
  preApprovedAmountInr: number | null;
  minLoanAmountInr: number;
  maxLoanAmountInr: number;
  detail: string;
};

export type CibilAssessmentInsights = {
  riskScore: number | null;
  noOfLoans: number;
  noOfCreditcards: number;
  noOfUnsecuredLoans: number;
  noOfSecuredLoans: number;
  noOfGoldLoans: number;
  sixMEnq: number;
  totalEnq: number;
  settledLoansCounts: number;
  totalOverdueAmounts: number;
  defaultLoans: string[];
  writeoffLoan: string[];
  settledLoan: string[];
  loanContainStatusSma: string[];
  loanContainStatusSub: string[];
  loanContainStatusDbt: string[];
  loanContainStatusLss: string[];
  dpd30Last3Months: string[];
  dpd60Last9Months: string[];
  dpd90Last12Months: string[];
  openLoanDpdLast6Months: string[];
  defaultsInLast18Months: string[];
  doubtfulInLast18Months: string[];
  restructuredLoans: string[];
  pwosTradelines: string[];
  missedPaymentsIn6m: string[];
  category: string | null;
};

export type CibilReportData = {
  generatedAt: string;
  bureauInquiryDate: string | null;
  controlNumber: string | null;
  consumerName: string;
  dateOfBirth: string | null;
  gender: string | null;
  pan: string | null;
  primaryMobile: string | null;
  emails: string[];
  cibilScore: number | null;
  scoreName: string | null;
  scoreRatingLabel: string | null;
  populationRank: string | null;
  employmentOccupation: string | null;
  employmentAccountType: string | null;
  employmentReportedDate: string | null;
  dateOfBirthDisplay: string | null;
  reportDateDisplay: string | null;
  vendorHtmlUrl: string | null;
  addresses: CibilReportAddressRow[];
  phones: CibilReportPhoneRow[];
  identifiers: CibilReportIdentifierRow[];
  accounts: CibilReportAccountRow[];
  inquiries: CibilReportInquiryRow[];
  creditSummary: {
    onTimePaymentHistory: string | null;
    creditCardUtilization: string | null;
    recentEnquiries: string | null;
    creditMix: string | null;
    oldestCreditAccountMonths: string | null;
  };
  scoreFactors: CibilReportScoreFactor[];
  accountOverview: CibilReportAccountOverviewRow[];
  exposureInsight: CibilReportExposureInsight;
  preApprovedInsight: CibilReportPreApprovedInsight | null;
  assessmentInsights?: CibilAssessmentInsights;
};

export type CibilCreditAssessmentSignals = {
  riskScore: number | null;
  noOfLoans: number;
  noOfCreditCards: number;
  noOfSecuredLoans: number;
  noOfUnsecuredLoans: number;
  noOfGoldLoans: number;
  sixMonthEnquiries: number;
  totalEnquiries: number;
  totalOverdueAmountInr: number;
  hasWilfulDefault: boolean;
  hasSuitFiledOnly: boolean;
  hasActiveDbt: boolean;
  hasActiveLss: boolean;
  hasActiveSub: boolean;
  doubtfulOrLossInLast18MonthsCount: number;
  defaultsInLast18MonthsCount: number;
  restructuredLoansCount: number;
  pwosTradelinesCount: number;
  settledLoansCount: number;
  writeoffPresent: boolean;
  writeoffTotalAmountInr: number;
  dpd30InLast3MonthsCount: number;
  dpd60InLast9MonthsCount: number;
  dpd90InLast12MonthsCount: number;
  openLoanDpdInLast6MonthsCount: number;
  missedPaymentsInLast6MonthsCount: number;
};

export type CibilCreditAssessment = {
  category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  categoryDescription: string;
  creditStatus: 'Approved' | 'Rejected';
  rejectionReasons: string | null;
  paymentProbabilityPct: number;
  creditRecommendation: 'Approved' | 'Rejected';
  recommendationRejectionReason: string | null;
  signals: CibilCreditAssessmentSignals;
};

export type LosApplicationCibilReportPayload = {
  bureauReportUuid: string;
  fetchedAt: string;
  reportPdfUrl: string | null;
  /** Original Tenacio / TrueLink bureau JSON stored on the bureau report row. */
  rawPayload: unknown;
  report: CibilReportData;
  creditAssessment: CibilCreditAssessment | null;
};

export async function getLeadCibilReport(
  token: string,
  leadUuid: string,
): Promise<LosApplicationCibilReportPayload> {
  return cachedAuthorizedLosGet<LosApplicationCibilReportPayload>(
    token,
    `/leads/${encodeURIComponent(leadUuid)}/cibil-report`,
    'Failed to load CIBIL report',
  );
}

export async function getApplicationCibilReport(
  token: string,
  applicationUuid: string,
): Promise<LosApplicationCibilReportPayload> {
  return cachedAuthorizedLosGet<LosApplicationCibilReportPayload>(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/cibil-report`,
    'Failed to load CIBIL report',
  );
}
