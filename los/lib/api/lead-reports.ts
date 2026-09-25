import { cachedAuthorizedLosGet, fetchWithTimeout, isFetchTimeoutError, messageFromBody, parseJsonResponse, resolveLosClientApiUrl, WORKBOOK_DOWNLOAD_TIMEOUT_MS } from './_shared';

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
  leadStatusCode: string;
  leadStatusLabel: string;
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

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) return decodeURIComponent(utf8[1].trim());
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

/** Authenticated workbook download — uses the Bearer header, not a query token. */
export async function downloadLeadReportsExport(token: string): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      resolveLosClientApiUrl('/lead-reports/export'),
      { headers: { Authorization: `Bearer ${token}` } },
      WORKBOOK_DOWNLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    if (isFetchTimeoutError(err)) {
      throw new Error('Download timed out while building the lead report. Please try again.');
    }
    throw err;
  }

  if (!response.ok) {
    const body = await parseJsonResponse(response);
    if (response.status === 401) {
      throw new Error('Session expired — please log in again.');
    }
    throw new Error(messageFromBody(body) ?? 'Failed to download lead report');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFromContentDisposition(response.headers.get('Content-Disposition'))
    ?? 'Lead report.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
