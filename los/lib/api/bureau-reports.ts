import { cachedAuthorizedLosGet, fetchWithTimeout, isFetchTimeoutError, messageFromBody, parseJsonResponse, resolveLosClientApiUrl, WORKBOOK_DOWNLOAD_TIMEOUT_MS } from './_shared';

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

/** URL for the "Credit Assessment data" workbook download (LOS Reports → Bureau Report). */
export function getBureauReportsExportUrl(token: string): string {
  const params = new URLSearchParams();
  params.set('access_token', token);
  return `${resolveLosClientApiUrl('/bureau-reports/export')}?${params.toString()}`;
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
export async function downloadBureauReportsExport(token: string): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      resolveLosClientApiUrl('/bureau-reports/export'),
      { headers: { Authorization: `Bearer ${token}` } },
      WORKBOOK_DOWNLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    if (isFetchTimeoutError(err)) {
      throw new Error('Download timed out while building the CIBIL workbook. Please try again.');
    }
    throw err;
  }

  if (!response.ok) {
    const body = await parseJsonResponse(response);
    if (response.status === 401) {
      throw new Error('Session expired — please log in again.');
    }
    throw new Error(messageFromBody(body) ?? 'Failed to download bureau reports');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFromContentDisposition(response.headers.get('Content-Disposition'))
    ?? 'Credit Assessment data.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
