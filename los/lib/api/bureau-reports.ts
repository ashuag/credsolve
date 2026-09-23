import { cachedAuthorizedLosGet, downloadAuthenticatedWorkbook } from './_shared';

export type LosBureauReportListItem = {
  uuid: string;
  leadUuid: string | null;
  /** Public journey ID (`lead.lead_id`); same value as application ID when an application exists. */
  leadNumber: string | null;
  customerUuid: string;
  applicationUuid: string | null;
  applicationNumber: string | null;
  fullName: string | null;
  mobileNumber: string;
  panNumber: string | null;
  cibilScore: number | null;
  /** Rule-based CIBIL credit-assessment category (A best .. H worst); null if not yet computed. */
  cibilCreditAssessmentCategory: string | null;
  dummyFetched: boolean;
  fetchedAt: string;
};

export async function getBureauReports(token: string): Promise<LosBureauReportListItem[]> {
  return cachedAuthorizedLosGet<LosBureauReportListItem[]>(
    token,
    '/bureau-reports',
    'Failed to load bureau reports',
  );
}

/**
 * Authenticated workbook download — uses the Bearer header, not a query token. Caller must pass the
 * table's active column filters (same keys as the Bureau Report table's columns) — the backend
 * rejects an empty set.
 */
export async function downloadBureauReportsExport(
  token: string,
  filters: Partial<Record<string, string>>,
): Promise<void> {
  return downloadAuthenticatedWorkbook({
    token,
    path: '/bureau-reports/export',
    filters,
    timeoutMessage: 'Download timed out while building the CIBIL workbook. Please try again.',
    fallbackErrorMessage: 'Failed to download bureau reports',
    fallbackFilename: 'Credit Assessment data.xlsx',
  });
}
