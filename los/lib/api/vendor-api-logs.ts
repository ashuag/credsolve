import { authorizedLosRequest } from './_shared';

export type VendorApiLogOutcome = 'success' | 'failure';

export type LosVendorApiLogListItem = {
  id: string;
  uuid: string;
  providerName: string;
  serviceName: string;
  requestMethod: string;
  requestPath: string | null;
  leadId: string | null;
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
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (!text) continue;
    q.set(key, text);
  }
  const s = q.toString();
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
