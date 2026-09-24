import { authorizedLosRequest, buildExportFilterParams, resolveLosClientApiUrl } from './_shared';

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

/** URL for the vendor API logs dump workbook download. Caller must pass at least one filter — the backend rejects an unfiltered export. */
export function getVendorApiLogsExportUrl(
  token: string,
  params: ListVendorApiLogsParams = {},
): string {
  const query = buildExportFilterParams(params);
  query.set('access_token', token);
  return `${resolveLosClientApiUrl('/developer-tools/vendor-api-logs/export')}?${query.toString()}`;
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
