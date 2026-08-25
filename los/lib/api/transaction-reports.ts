import { cachedAuthorizedLosGet, fetchWithTimeout, isFetchTimeoutError, messageFromBody, parseJsonResponse, resolveLosClientApiUrl, WORKBOOK_DOWNLOAD_TIMEOUT_MS } from './_shared';

export type LosTransactionReportListItem = {
  uuid: string;
  transactionId: string;
  loanNumber: string;
  applicationUuid: string;
  applicationNumber: string;
  customerUuid: string;
  leadUuid: string;
  fullName: string | null;
  mobileNumber: string;
  email: string | null;
  dateOfBirth: string | null;
  panNumber: string | null;
  disbursedAt: string;
  disbursedAmount: string;
  interestReceived: string;
  interestRate: string;
  processingFeePercent: string | null;
  processingFeeAmount: string | null;
  gstOnPfPercent: string | null;
  gstAmount: string | null;
  dueDate: string | null;
  repaymentAt: string | null;
  daysExceeded: number;
  penalCharges: string;
};

export async function getTransactionReports(token: string): Promise<LosTransactionReportListItem[]> {
  return cachedAuthorizedLosGet<LosTransactionReportListItem[]>(
    token,
    '/transaction-reports',
    'Failed to load transaction reports',
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
export async function downloadTransactionReportsExport(token: string): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      resolveLosClientApiUrl('/transaction-reports/export'),
      { headers: { Authorization: `Bearer ${token}` } },
      WORKBOOK_DOWNLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    if (isFetchTimeoutError(err)) {
      throw new Error('Download timed out while building the transaction report. Please try again.');
    }
    throw err;
  }

  if (!response.ok) {
    const body = await parseJsonResponse(response);
    if (response.status === 401) {
      throw new Error('Session expired — please log in again.');
    }
    throw new Error(messageFromBody(body) ?? 'Failed to download transaction report');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFromContentDisposition(response.headers.get('Content-Disposition'))
    ?? 'Transaction report.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
