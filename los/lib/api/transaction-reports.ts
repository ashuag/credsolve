import { cachedAuthorizedLosGet, downloadAuthenticatedWorkbook } from './_shared';

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

/**
 * Authenticated workbook download — uses the Bearer header, not a query token. Caller must pass the
 * table's active column filters (same keys as the Transaction Report table's columns) — the
 * backend rejects an empty set.
 */
export async function downloadTransactionReportsExport(
  token: string,
  filters: Partial<Record<string, string>>,
): Promise<void> {
  return downloadAuthenticatedWorkbook({
    token,
    path: '/transaction-reports/export',
    filters,
    timeoutMessage: 'Download timed out while building the transaction report. Please try again.',
    fallbackErrorMessage: 'Failed to download transaction report',
    fallbackFilename: 'Transaction report.xlsx',
  });
}
