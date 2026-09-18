/**
 * CIBIL07 CIBIL soft-pull → Tenacio bureau envelope.
 *
 * CIBIL07 API's `POST /api/cibil/soft-pull` returns an outer envelope:
 *
 *   { success, request_uuid, status, http_status, data, error? }
 *
 * where `data` is the **raw** PayMe India CIBIL merchant response. In practice
 * PayMe India returns a flat PaisaBazaar-family payload at `data.data`
 * (`{ cibil: [...], loan_type: [...], repayment_loan_type: [...], addresses: [...] }`);
 * `payme-india-cibil-to-truelink` re-keys that into a `TrueLinkCreditReport`.
 * A pre-shaped TrueLink payload (`data.cibilData…`) is also accepted for
 * forward-compat.
 *
 * All downstream consumers (post-BRE rules, tradeline exposure, the LOS report
 * PDF, score parsing) read the Tenacio / TrueLink shape:
 *
 *   { status, serviceStatusCode, requestId,
 *     data.cibilData.GetCustomerAssetsResponse.GetCustomerAssetsSuccess
 *       .Asset.TrueLinkCreditReport.{Borrower, TradeLinePartition, …} }
 */
import { unwrapVendorApiLogPayload } from '../vendor-api-log-payload.util';
import { isPayMeIndiaFlatReport, payMeIndiaFlatToTrueLink } from './payme-india-cibil-to-truelink';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asNonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function looksLikeBureauReport(v: unknown): boolean {
  const rec = asRecord(v);
  if (!rec) return false;
  return (
    rec.GetCustomerAssetsResponse != null ||
    rec.cibilData != null ||
    rec.TrueLinkCreditReport != null
  );
}

/** True when the payload is already a Tenacio-style bureau envelope. */
function isTenacioBureauEnvelope(body: unknown): boolean {
  const root = asRecord(body);
  if (!root) return false;
  if (root.serviceStatusCode != null || root.serviceError != null) return true;
  const status = asNonEmptyString(root.status)?.toLowerCase();
  if ((status === 'success' || status === 'error') && asRecord(root.data)?.cibilData != null) {
    return true;
  }
  return false;
}

function extractRequestId(body: unknown): string | null {
  const root = asRecord(body);
  if (!root) return null;
  return (
    asNonEmptyString(root.requestId) ??
    asNonEmptyString(root.request_id) ??
    asNonEmptyString(root.request_uuid) ??
    asNonEmptyString(root.referenceId) ??
    asNonEmptyString(root.reference_id)
  );
}

function extractHtmlUrl(body: unknown): string | null {
  const root = asRecord(body);
  if (!root) return null;
  const data = asRecord(root.data) ?? asRecord(root.result);
  return (
    asNonEmptyString(root.htmlUrl) ??
    asNonEmptyString(root.html_url) ??
    asNonEmptyString(data?.htmlUrl) ??
    asNonEmptyString(data?.html_url) ??
    asNonEmptyString(data?.reportUrl) ??
    asNonEmptyString(data?.report_url)
  );
}

function extractErrorMessage(body: unknown): string | null {
  const root = asRecord(body);
  if (!root) return null;
  const serviceError = asRecord(root.serviceError);
  const data = asRecord(root.data);
  const err = asRecord(root.error);
  return (
    asNonEmptyString(serviceError?.message) ??
    asNonEmptyString(err?.message) ??
    asNonEmptyString(root.message) ??
    asNonEmptyString(root.error_message) ??
    asNonEmptyString(root.errorMessage) ??
    asNonEmptyString(data?.message)
  );
}

/** Pulls the bureau report object that Tenacio stores under `data.cibilData`. */
function extractCibilMerchantReport(body: unknown): unknown | null {
  const root = asRecord(body);
  if (!root) return null;

  if (root.GetCustomerAssetsResponse != null) return root;

  const nested =
    root.cibilData ??
    root.cibil_data ??
    root.report ??
    root.cibilReport ??
    root.cibil_report ??
    null;
  if (looksLikeBureauReport(nested) || asRecord(nested)) {
    if (
      asRecord(nested)?.GetCustomerAssetsResponse != null ||
      asRecord(nested)?.TrueLinkCreditReport != null
    ) {
      return nested;
    }
    if (asRecord(nested)?.cibilData != null) {
      return asRecord(nested)?.cibilData ?? nested;
    }
  }

  const data = asRecord(root.data) ?? asRecord(root.result) ?? asRecord(root.payload);
  if (!data) return nested != null ? nested : null;

  if (data.GetCustomerAssetsResponse != null) return data;

  const fromData =
    data.cibilData ??
    data.cibil_data ??
    data.report ??
    data.cibilReport ??
    data.cibil_report ??
    null;
  if (fromData != null) {
    const rec = asRecord(fromData);
    if (rec?.cibilData != null) return rec.cibilData;
    return fromData;
  }

  if (looksLikeBureauReport(data)) return data;
  return null;
}

function isExplicitFailure(body: unknown, httpStatus: number | null): boolean {
  if (httpStatus != null && httpStatus >= 400) return true;
  const root = asRecord(body);
  if (!root) return httpStatus == null;
  if (root.success === false || root.status === false) return true;
  const status = asNonEmptyString(root.status)?.toLowerCase();
  if (status === 'error' || status === 'failed' || status === 'failure') return true;
  return false;
}

function isNoHit(body: unknown, httpStatus: number | null, report: unknown | null): boolean {
  if (httpStatus === 404 || httpStatus === 422) return true;
  const message = (extractErrorMessage(body) ?? '').toLowerCase();
  if (/\bno[-\s]?hit\b|\bno matching\b|\bno record\b|\bnot found\b/.test(message)) return true;
  if (report == null && httpStatus != null && httpStatus >= 400 && httpStatus < 500) return true;
  return false;
}

export type TenacioWrappedBureauBody = {
  sourceVendor?: string;
  status: 'success' | 'error';
  serviceStatusCode: number;
  requestId: string | null;
  data?: { htmlUrl: string | null; cibilData: unknown };
  serviceError?: { message: string };
};

/** Wrap a `TrueLinkCreditReport` object in the Tenacio `GetCustomerAssetsResponse` envelope. */
function trueLinkSuccessEnvelope(
  trueLinkCreditReport: Record<string, unknown>,
  requestId: string | null,
): TenacioWrappedBureauBody {
  return {
    status: 'success',
    serviceStatusCode: 200,
    requestId,
    data: {
      htmlUrl: null,
      cibilData: {
        GetCustomerAssetsResponse: {
          ResponseStatus: 'Success',
          GetCustomerAssetsSuccess: {
            Asset: { Type: 'SingleCreditReport', TrueLinkCreditReport: trueLinkCreditReport },
          },
        },
      },
    },
  };
}

/** Candidate inner payloads to inspect for the PayMe India flat report. */
function flatReportCandidates(softPullData: unknown): unknown[] {
  const d = asRecord(softPullData);
  if (!d) return [softPullData];
  return [d.data, d.result, d.payload, softPullData].filter((c) => c !== undefined);
}

/** Wrap a raw PayMe India merchant payload into the Tenacio bureau envelope. */
function wrapCibilMerchantToTenacio(input: {
  body: unknown;
  httpStatus: number | null;
  requestId?: string | null;
}): TenacioWrappedBureauBody {
  const { body, httpStatus } = input;
  const requestId = extractRequestId(body) ?? input.requestId ?? null;

  if (isTenacioBureauEnvelope(body)) {
    const root = asRecord(body) ?? {};
    const statusRaw = asNonEmptyString(root.status)?.toLowerCase();
    const status = statusRaw === 'error' ? 'error' : 'success';
    const serviceStatusCode =
      typeof root.serviceStatusCode === 'number'
        ? root.serviceStatusCode
        : Number.parseInt(
            String(root.serviceStatusCode ?? (status === 'success' ? 200 : 502)),
            10,
          );
    const data = asRecord(root.data);
    const serviceError = asRecord(root.serviceError);
    return {
      status: Number.isFinite(serviceStatusCode) && serviceStatusCode >= 400 ? 'error' : status,
      serviceStatusCode: Number.isFinite(serviceStatusCode)
        ? serviceStatusCode
        : status === 'success'
          ? 200
          : 502,
      requestId: asNonEmptyString(root.requestId) ?? requestId,
      ...(data
        ? { data: { htmlUrl: asNonEmptyString(data.htmlUrl), cibilData: data.cibilData ?? null } }
        : {}),
      ...(serviceError?.message
        ? { serviceError: { message: String(serviceError.message) } }
        : {}),
    };
  }

  const report = extractCibilMerchantReport(body);
  const failed = isExplicitFailure(body, httpStatus) || report == null;
  if (!failed) {
    return {
      status: 'success',
      serviceStatusCode: 200,
      requestId,
      data: {
        htmlUrl: extractHtmlUrl(body),
        cibilData: report,
      },
    };
  }

  const noHit = isNoHit(body, httpStatus, report);
  const serviceStatusCode = noHit
    ? httpStatus != null && httpStatus >= 400 && httpStatus < 500
      ? httpStatus
      : 422
    : httpStatus != null && httpStatus >= 500
      ? httpStatus
      : 502;

  return {
    status: 'error',
    serviceStatusCode,
    requestId,
    serviceError: {
      message:
        extractErrorMessage(body) ?? (noHit ? 'No matching bureau record' : 'Bureau request failed'),
    },
  };
}

/** Soft-pull `status` values that mean the call never reached / completed at the bureau. */
const SOFT_PULL_TRANSPORT_FAILURE_STATUS: Record<string, number> = {
  NOT_CONFIGURED: 503,
  TIMEOUT: 504,
  VENDOR_ERROR: 502,
};

/**
 * Normalise CIBIL07 API's `/api/cibil/soft-pull` response into the Tenacio
 * bureau envelope.
 *
 * @param softPullBody parsed JSON body from the soft-pull endpoint
 *   (`{ success, request_uuid, status, http_status, data, error? }`), or `null`.
 * @param httpStatus   HTTP status of the soft-pull call itself.
 * @param context      optional borrower fields not echoed by the vendor (name).
 */
export function mapCibil07SoftPullToTenacioEnvelope(
  softPullBody: unknown,
  httpStatus: number | null,
  context: { fullName?: string | null } = {},
): TenacioWrappedBureauBody {
  return {
    sourceVendor: 'CIBIL07',
    ...buildCibil07TenacioEnvelope(
      unwrapVendorApiLogPayload(softPullBody),
      httpStatus,
      context,
    ),
  };
}

function buildCibil07TenacioEnvelope(
  softPullBody: unknown,
  httpStatus: number | null,
  context: { fullName?: string | null } = {},
): TenacioWrappedBureauBody {
  const root = asRecord(softPullBody);

  // No parseable body — treat as a transport failure so the chain falls through.
  if (!root) {
    return {
      status: 'error',
      serviceStatusCode: httpStatus != null && httpStatus >= 500 ? httpStatus : 502,
      requestId: null,
      serviceError: { message: 'CIBIL07 soft-pull returned no body' },
    };
  }

  const requestId = extractRequestId(root);
  const softPullStatus = asNonEmptyString(root.status)?.toUpperCase() ?? null;
  const success = root.success === true;

  // The soft-pull endpoint itself failed before/at the bureau (auth, timeout,
  // vendor outage, not configured). Surface a Tenacio error envelope.
  const transportFailureCode = softPullStatus
    ? SOFT_PULL_TRANSPORT_FAILURE_STATUS[softPullStatus]
    : undefined;
  if (!success && transportFailureCode != null) {
    const err = asRecord(root.error);
    return {
      status: 'error',
      serviceStatusCode: transportFailureCode,
      requestId,
      serviceError: {
        message:
          asNonEmptyString(err?.message) ??
          asNonEmptyString(root.message) ??
          `CIBIL07 soft-pull ${softPullStatus}`,
      },
    };
  }

  // `data` holds the raw PayMe India merchant payload. Prefer the soft-pull's
  // own `http_status` (the bureau HTTP status) over the outer transport status.
  const bureauHttpStatus =
    typeof root.http_status === 'number' ? root.http_status : httpStatus;

  // PayMe India returns a flat PaisaBazaar-family report (usually at data.data).
  for (const candidate of flatReportCandidates(root.data)) {
    if (!isPayMeIndiaFlatReport(candidate)) continue;
    const mapped = payMeIndiaFlatToTrueLink(candidate, context);
    if (mapped.ok && mapped.trueLinkCreditReport) {
      return trueLinkSuccessEnvelope(mapped.trueLinkCreditReport, requestId);
    }
    // Recognised as PayMe India but no usable data → no-hit (NTC).
    return {
      status: 'error',
      serviceStatusCode: 422,
      requestId,
      serviceError: { message: mapped.reason ?? 'No matching bureau record' },
    };
  }

  const wrapped = wrapCibilMerchantToTenacio({
    body: root.data ?? root,
    httpStatus: bureauHttpStatus ?? null,
    requestId,
  });

  // Carry the soft-pull error message through when the bureau payload had none.
  if (wrapped.status === 'error' && !wrapped.serviceError?.message) {
    const err = asRecord(root.error);
    const message =
      asNonEmptyString(err?.message) ?? asNonEmptyString(root.message) ?? 'Bureau request failed';
    return { ...wrapped, serviceError: { message } };
  }

  return wrapped;
}
