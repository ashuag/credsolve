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

export type ParsedTenacioBureauEnvelope = {
  status: string | null;
  serviceStatusCode: number | null;
  serviceErrorMessage: string | null;
  requestId: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function parseScoreFromRiskScore(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number.parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** CIBIL reports -1, 0 or 1 when the borrower has no usable credit history (NTC). */
export function isCibilNewToCreditScore(
  score: number | null | undefined,
): boolean {
  return score == null || Number.isNaN(score) || [-1, 0, 1].includes(score);
}

function parseServiceStatusCode(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number.parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** Reads Tenacio bureau envelope fields (`serviceStatusCode`, `serviceError`, `status`). */
export function parseTenacioBureauEnvelope(body: unknown): ParsedTenacioBureauEnvelope {
  const root = asRecord(body);
  if (!root) {
    return {
      status: null,
      serviceStatusCode: null,
      serviceErrorMessage: null,
      requestId: null,
    };
  }

  const serviceError = asRecord(root.serviceError);
  const message =
    typeof serviceError?.message === 'string' && serviceError.message.trim()
      ? serviceError.message.trim()
      : null;

  return {
    status: typeof root.status === 'string' ? root.status.trim().toLowerCase() : null,
    serviceStatusCode: parseServiceStatusCode(root.serviceStatusCode),
    serviceErrorMessage: message,
    requestId: typeof root.requestId === 'string' ? root.requestId : null,
  };
}

/** True when Tenacio returned a 4xx `serviceStatusCode` (identity / no-hit / validation errors). */
export function isTenacioBureauClientError(serviceStatusCode: number | null | undefined): boolean {
  return serviceStatusCode != null && serviceStatusCode >= 400 && serviceStatusCode < 500;
}

export function isTenacioBureauServerError(serviceStatusCode: number | null | undefined): boolean {
  return serviceStatusCode != null && serviceStatusCode >= 500;
}

/**
 * Whether the bureau soft-pull payload represents a successful report (not an error envelope).
 * HTTP may still be 200 when `serviceStatusCode` is 422.
 */
export function isTenacioBureauSuccessPayload(body: unknown): boolean {
  const envelope = parseTenacioBureauEnvelope(body);
  if (envelope.status === 'error') return false;
  if (isTenacioBureauClientError(envelope.serviceStatusCode)) return false;
  if (isTenacioBureauServerError(envelope.serviceStatusCode)) return false;
  if (envelope.serviceStatusCode != null && envelope.serviceStatusCode !== 200) return false;

  const parsed = parseTenacioBureauVendorBody(body);
  if (parsed.bureauScore != null) return true;
  if (parsed.responseStatus?.toLowerCase() === 'success') return true;

  const root = asRecord(body);
  const data = root ? asRecord(root.data) : null;
  return data?.cibilData != null;
}

export function tenacioBureauFailureNote(body: unknown, httpStatus: number | null): string {
  const envelope = parseTenacioBureauEnvelope(body);
  const parts: string[] = [];
  if (httpStatus != null) parts.push(`http=${httpStatus}`);
  if (envelope.serviceStatusCode != null) parts.push(`service=${envelope.serviceStatusCode}`);
  if (envelope.serviceErrorMessage) parts.push(envelope.serviceErrorMessage);
  return parts.join(' | ').slice(0, 500) || 'Bureau soft-pull failed';
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
