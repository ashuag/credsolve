import { authorizedLosRequest } from './_shared';

export type LosCheckDisbursementStatusInput = {
  applicationNumber?: string;
  fromDate?: string;
  toDate?: string;
};

export type LosCheckDisbursementStatusRow = {
  applicationNumber: string;
  applicationUuid: string;
  loanNumber: string;
  uniqueRequestNumber: string;
  storedUtr: string | null;
  loanStatusCode: string;
  loanStatusLabel: string;
  disbursedAt: string;
  netDisbursedAmount: string;
  apiHttpOk: boolean;
  apiStatus: string | null;
  apiUtr: string | null;
  apiFailureReason: string | null;
  apiMessage: string | null;
  vendorBody: unknown | null;
};

export type LosCheckDisbursementStatusResult = {
  vendor: 'Easebuzz';
  configured: boolean;
  skipReason: string | null;
  retrieveUrl: string | null;
  filter: { applicationNumber: string | null; fromDate: string | null; toDate: string | null };
  matched: number;
  truncated: boolean;
  rows: LosCheckDisbursementStatusRow[];
};

/** Reads stored quick-transfer-initiate vendor_api_log rows (does not update a loan). */
export async function runCheckDisbursementStatus(
  token: string,
  input: LosCheckDisbursementStatusInput,
): Promise<LosCheckDisbursementStatusResult> {
  return authorizedLosRequest<LosCheckDisbursementStatusResult>(
    token,
    '/developer-tools/check-disbursement-status',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Check disbursement status failed.',
    180_000,
  );
}
