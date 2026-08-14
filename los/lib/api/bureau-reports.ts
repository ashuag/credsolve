import { cachedAuthorizedLosGet, resolveLosClientApiUrl } from './_shared';

export type LosBureauReportListItem = {
  uuid: string;
  leadUuid: string;
  customerUuid: string;
  applicationUuid: string | null;
  applicationNumber: string | null;
  fullName: string | null;
  mobileNumber: string;
  panNumber: string | null;
  cibilScore: number | null;
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
