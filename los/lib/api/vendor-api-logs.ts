<<<<<<< HEAD
import { authorizedLosRequest, resolveLosClientApiUrl } from './_shared';
=======
import { authorizedLosRequest, buildExportFilterParams, cachedAuthorizedLosGet, downloadAuthenticatedWorkbook } from './_shared';
>>>>>>> refs/remotes/moneycash/main

export type VendorApiLogOutcome = 'success' | 'failure';

export type LosVendorApiLogListItem = {
  id: string;
  uuid: string;
  providerName: string;
  serviceName: string;
  requestMethod: string;
  requestPath: string | null;
  leadId: string | null;
  applicationUuid: string | null;
  applicationNumber: string | null;
  httpStatus: number | null;
  requestedAt: string;
  respondedAt: string;
  durationMs: number;
  outcome: VendorApiLogOutcome;
};

export type LosVendorApiLogDetail = LosVendorApiLogListItem & {
  requestHeaders: unknown;
  requestPayload: unknown;
  responsePayload: unknown;
};

export type ListVendorApiLogsParams = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  providerName?: string;
  serviceName?: string;
  requestMethod?: string;
  httpStatus?: string;
  id?: string;
  leadId?: string;
  applicationNumber?: string;
  requestPath?: string;
  outcome?: string;
  requestedFrom?: string;
  requestedTo?: string;
};

export type ListVendorApiLogsResponse = {
  items: LosVendorApiLogListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type VendorApiLogFilterOptions = {
  providerNames: string[];
  serviceNames: string[];
};

function buildQuery(params: ListVendorApiLogsParams): string {
  const s = buildExportFilterParams(params).toString();
  return s ? `?${s}` : '';
}

export async function listVendorApiLogs(
  token: string,
  params: ListVendorApiLogsParams = {},
): Promise<ListVendorApiLogsResponse> {
  return authorizedLosRequest<ListVendorApiLogsResponse>(
    token,
    `/developer-tools/vendor-api-logs${buildQuery(params)}`,
    { method: 'GET', cache: 'no-store' },
    'Unable to load vendor API logs.',
  );
}

<<<<<<< HEAD
/** URL for the vendor API logs dump workbook download. Caller must pass at least one filter — the backend rejects an unfiltered export. */
export function getVendorApiLogsExportUrl(
  token: string,
  params: ListVendorApiLogsParams = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (!text) continue;
    query.set(key, text);
  }
  query.set('access_token', token);
  return `${resolveLosClientApiUrl('/developer-tools/vendor-api-logs/export')}?${query.toString()}`;
=======
/**
 * Authenticated workbook download for the vendor API logs dump. Caller must pass at least one
 * filter — the backend rejects an unfiltered export.
 */
export async function downloadVendorApiLogsExport(
  token: string,
  filters: Partial<Record<string, string>>,
): Promise<void> {
  return downloadAuthenticatedWorkbook({
    token,
    path: '/developer-tools/vendor-api-logs/export',
    filters,
    timeoutMessage: 'Download timed out while building the vendor API logs workbook. Please try again.',
    fallbackErrorMessage: 'Failed to download vendor API logs',
    fallbackFilename: 'Vendor API Logs.xlsx',
  });
}

/** Distinct provider/service names for the Provider/Service filter dropdowns. */
export async function getVendorApiLogFilterOptions(token: string): Promise<VendorApiLogFilterOptions> {
  return cachedAuthorizedLosGet<VendorApiLogFilterOptions>(
    token,
    '/developer-tools/vendor-api-logs/filter-options',
    'Unable to load vendor API log filter options.',
  );
>>>>>>> refs/remotes/moneycash/main
}

export async function getVendorApiLog(
  token: string,
  uuid: string,
): Promise<LosVendorApiLogDetail> {
  return authorizedLosRequest<LosVendorApiLogDetail>(
    token,
    `/developer-tools/vendor-api-logs/${encodeURIComponent(uuid)}`,
    { method: 'GET', cache: 'no-store' },
    'Unable to load vendor API log detail.',
  );
}
