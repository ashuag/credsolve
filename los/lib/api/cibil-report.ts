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
};

export type LosApplicationCibilReportPayload = {
  bureauReportUuid: string;
  fetchedAt: string;
  reportPdfUrl: string | null;
  htmlUrl: string | null;
  /** Original Tenacio / TrueLink bureau JSON stored on the bureau report row. */
  rawPayload: unknown;
  report: CibilReportData;
};

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
