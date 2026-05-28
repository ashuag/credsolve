/**
 * Extracts stable fields from Tenacio / Experian soft-pull JSON (shape varies by workflow).
 * Tolerates missing branches when the vendor envelope differs.
 */
export type ParsedTenacioBureauFields = {
  bureauScore: number | null;
  htmlUrl: string | null;
  vendorRequestId: string | null;
  responseStatus: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function parseScoreFromRiskScore(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number.parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** CIBIL reports -1 or 0 when the borrower has no usable credit history (NTC). */
export function isCibilNewToCreditScore(score: number | null): boolean {
  return score === -1 || score === 0;
}

/** Walk `GetCustomerAssetsSuccess.Asset` (object or first element of array). */
function readAssetTrueLink(asset: unknown): Record<string, unknown> | null {
  const a = asRecord(asset);
  if (!a) return null;
  return asRecord(a.TrueLinkCreditReport);
}

export function parseTenacioBureauVendorBody(body: unknown): ParsedTenacioBureauFields {
  const out: ParsedTenacioBureauFields = {
    bureauScore: null,
    htmlUrl: null,
    vendorRequestId: null,
    responseStatus: null,
  };
  const root = asRecord(body);
  if (!root) return out;

  if (typeof root.requestId === 'string') out.vendorRequestId = root.requestId;

  const data = asRecord(root.data);
  if (!data) return out;

  if (typeof data.htmlUrl === 'string') out.htmlUrl = data.htmlUrl;

  const cibilData = asRecord(data.cibilData);
  if (!cibilData) return out;

  const gcr = asRecord(cibilData.GetCustomerAssetsResponse);
  if (!gcr) return out;

  if (typeof gcr.ResponseStatus === 'string') out.responseStatus = gcr.ResponseStatus;

  const success = asRecord(gcr.GetCustomerAssetsSuccess);
  if (!success) return out;

  let asset = success.Asset;
  if (Array.isArray(asset)) asset = asset[0];
  const tlr = readAssetTrueLink(asset);
  if (!tlr) return out;

  const borrower = asRecord(tlr.Borrower);
  if (!borrower) return out;

  const creditScore = asRecord(borrower.CreditScore);
  if (creditScore && creditScore.riskScore !== undefined) {
    out.bureauScore = parseScoreFromRiskScore(creditScore.riskScore);
  }

  return out;
}
