import { authorizedLosRequest, clientApiUrl, messageFromBody, parseJsonResponse } from './_shared';

export type PostBreRuleFinding = {
  title: string;
  detail?: string | null;
  data?: Record<string, string | number | boolean | null>;
};

export type PostBreRuleCheck = {
  id: string;
  label: string;
  passed: boolean;
  rejectionReasonCode: string | null;
  detail: string | null;
  meta?: Record<string, string | number | boolean | null>;
  criteriaKeys?: string[];
  findings?: PostBreRuleFinding[];
};

export type PostBreCriteriaConfigRow = {
  key: string;
  label: string;
  description: string | null;
  value: string;
  ruleEnabled: boolean;
  appliesToCheckIds: string[];
};

export type PostBreTradelineInspectionRow = {
  rowIndex: number;
  creditorName: string;
  accountNumber: string | null;
  accountTypeSymbol: string | null;
  accountTypeLabel: string;
  accountStatus: string;
  isOpen: boolean;
  isLoanRelated: boolean;
  isMfiAccount: boolean;
  restructureSignal: boolean;
  smaPwosSignal: boolean;
  evaluatedByRules: string[];
};

export type PostBreEnquiryInspectionRow = {
  inquiryDate: string;
  inquiryType: string | null;
  inquiryTypeLabel: string;
  subscriberName: string | null;
  controlNumber: string | null;
  amount: string | null;
  inRollingWindow: boolean;
  countsTowardLoanEnquiryLimit: boolean;
  excludeReason: string | null;
};

export type PostBreBureauSummary = {
  vendorRequestId: string | null;
  responseStatus: string | null;
  bureauInquiryDate: string | null;
  tradelineCount: number;
  openTradelineCount: number;
  closedTradelineCount: number;
  totalEnquiryCount: number;
  loanEnquiryCountInWindow: number;
  enquiryWindowDays: number;
};

export type PostBreInspection = {
  bureau: PostBreBureauSummary;
  criteria: PostBreCriteriaConfigRow[];
  tradelines: PostBreTradelineInspectionRow[];
  enquiries: PostBreEnquiryInspectionRow[];
};

export type PostBreDryRunResult = {
  overallPassed: boolean;
  cibilScore: number | null;
  isExistingCustomer: boolean;
  thresholds: {
    cibilMinNew: number;
    cibilMinExisting: number;
    settledLookbackMonths: number;
    maxEnquiries30Days: number;
    openDpdMonths: number;
    dpd30PlusMonths: number;
    dpd60PlusMonths: number;
    dpd90PlusMonths: number;
    enforceNoRestructuredLoans: boolean;
    enforceNoSmaPwos: boolean;
    enforceNoActiveMfi: boolean;
  };
  checks: PostBreRuleCheck[];
  inspection: PostBreInspection;
};

export type PreBreDryRunResult = {
  passed: boolean;
  rejectReason: string | null;
  rejectionReasonCode: string | null;
  thresholds: {
    minAge: number;
    maxAge: number;
    rejectedGenderIds: number[];
    rejectedOccupationIds: number[];
  };
};

export type OpenUnsecuredTradelineRow = {
  creditorName: string;
  accountNumber: string;
  accountTypeSymbol: string | null;
  accountTypeLabel: string;
  dateOpened: string | null;
  dateClosed: string | null;
  exposureInr: number;
  drivesTier: boolean;
};

export type PreApprovedOfferDryRunResult = {
  cibilScore: number | null;
  maxOpenUnsecuredExposureInr: number;
  totalOpenUnsecuredExposureInr: number;
  openUnsecuredTradelines: OpenUnsecuredTradelineRow[];
  tier: {
    tierId: number;
    minUnsecuredLoan: number;
    maxUnsecuredLoan: number | null;
    maxBulletLoan: number;
  } | null;
  preApprovedAmountInr: number | null;
  minLoanAmountInr: number;
  maxLoanAmountInr: number;
  detail: string;
};

export async function runPreBreCheck(
  token: string,
  body: {
    dateOfBirth: string;
    genderId: number;
    occupationId: number;
    genderDisplay?: string;
    occupationDisplay?: string;
    pincode: string;
    cityId?: number;
    stateId?: number;
    cityName?: string;
    stateCode?: string;
  },
): Promise<PreBreDryRunResult> {
  return authorizedLosRequest<PreBreDryRunResult>(
    token,
    '/bre/pre-bre-check',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Unable to run pre-BRE check.',
  );
}

export async function runPreApprovedOfferCheck(
  token: string,
  body: { bureauPayload: Record<string, unknown> },
): Promise<PreApprovedOfferDryRunResult> {
  return authorizedLosRequest<PreApprovedOfferDryRunResult>(
    token,
    '/bre/pre-approved-offer-check',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Unable to run pre-approved offer check.',
  );
}

export type PostBreRuleCatalogEntry = {
  id: string;
  label: string;
  category: 'score' | 'tradeline' | 'enquiry' | 'dpd' | 'diagnostic';
  informationalOnly: boolean;
  alwaysEvaluated: boolean;
  toggleCriteriaKey: string | null;
  criteriaKeys: string[];
  rejectionReasonCode: string | null;
  condition: string;
  passCondition: string;
  dataSources: string[];
  tuefReference: string | null;
  notes: string | null;
};

export type PostBreRulesCatalogResult = {
  enquiryWindowDays: number;
  thresholds: PostBreDryRunResult['thresholds'];
  criteria: PostBreCriteriaConfigRow[];
  rules: PostBreRuleCatalogEntry[];
};

export async function fetchPostBreRulesCatalog(token: string): Promise<PostBreRulesCatalogResult> {
  return authorizedLosRequest<PostBreRulesCatalogResult>(
    token,
    '/bre/post-bre-rules-catalog',
    { method: 'GET' },
    'Unable to load post-BRE rules catalog.',
  );
}

export async function runPostBureauBreCheck(
  token: string,
  body: { bureauPayload: Record<string, unknown>; isExistingCustomer: boolean },
): Promise<PostBreDryRunResult> {
  return authorizedLosRequest<PostBreDryRunResult>(
    token,
    '/bre/post-bureau-check',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Unable to run post-BRE check.',
  );
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";\n]+)"?/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

/** Generates a CIBIL PDF in memory and returns it as a blob (nothing is stored server-side). */
export async function downloadCibilReportPdf(
  token: string,
  body: { bureauPayload: Record<string, unknown> },
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${clientApiUrl()}/bre/cibil-report-download`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const errBody = await parseJsonResponse(response);
    throw new Error(messageFromBody(errBody) ?? 'Unable to generate CIBIL report PDF.');
  }

  const filename = filenameFromContentDisposition(response.headers.get('Content-Disposition')) ?? 'cibil-report.pdf';
  const blob = await response.blob();
  return { blob, filename };
}
