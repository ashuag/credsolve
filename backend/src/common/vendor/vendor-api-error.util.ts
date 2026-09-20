function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Best-effort extraction of a vendor business `statusCode` from common JSON envelopes.
 *
 * Prefers the authoritative top-level `serviceStatusCode` (the aggregated
 * service result) over per-provider entries in `vendorResponse[]`. A single
 * upstream provider can fail (e.g. `500`) while the overall service result is a
 * `4xx`/`2xx`; using the per-provider code would misclassify those as outages.
 * Falls back to `statusCode`, nested `data`, then the first `vendorResponse[]`
 * entry so older envelopes keep working.
 */
export function extractVendorResponseStatusCode(body: unknown, depth = 0): number | null {
  if (depth > 4 || !isRecord(body)) return null;

  const serviceCode = body.serviceStatusCode;
  if (typeof serviceCode === 'number' && Number.isFinite(serviceCode)) return serviceCode;

  const direct = body.statusCode;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

  const data = body.data;
  if (isRecord(data)) {
    const fromData = extractVendorResponseStatusCode(data, depth + 1);
    if (fromData != null) return fromData;
  }

  const vendorResponse = body.vendorResponse;
  if (Array.isArray(vendorResponse)) {
    for (const item of vendorResponse) {
      if (isRecord(item) && typeof item.statusCode === 'number' && Number.isFinite(item.statusCode)) {
        return item.statusCode;
      }
    }
  }

  return null;
}

export type VendorServiceError = {
  /** Aggregated service status code, e.g. `422`. `null` when absent. */
  serviceStatusCode: number | null;
  /** Human-readable `serviceError.message`, when the vendor provides one. */
  message: string | null;
};

/**
 * Detects a vendor "service error" envelope — the request was accepted and
 * processed, but the provider returned a business-level failure, e.g.:
 * `{ status: 'error', serviceStatusCode: 422, serviceError: { message: '…' } }`.
 *
 * Returns `null` for success / non-error envelopes.
 */
export function extractVendorServiceError(body: unknown): VendorServiceError | null {
  if (!isRecord(body)) return null;

  const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : null;
  const serviceError = isRecord(body.serviceError) ? body.serviceError : null;
  const serviceStatusCode =
    typeof body.serviceStatusCode === 'number' && Number.isFinite(body.serviceStatusCode)
      ? body.serviceStatusCode
      : null;

  const isError =
    status === 'error' ||
    serviceError != null ||
    (serviceStatusCode != null && serviceStatusCode >= 400);
  if (!isError) return null;

  const message =
    serviceError && typeof serviceError.message === 'string' ? serviceError.message.trim() || null : null;

  return { serviceStatusCode, message };
}

export function isHttp5xx(status: number | null | undefined): boolean {
  return status != null && status >= 500 && status < 600;
}

export function isVendorApi5xxFailure(params: {
  httpStatus: number | null;
  body: unknown;
}): boolean {
  if (isHttp5xx(params.httpStatus)) return true;
  const apiCode = extractVendorResponseStatusCode(params.body);
  return apiCode != null && apiCode >= 500 && apiCode < 600;
}

const AADHAAR_XML_OTP_FALLBACK_SERVICES = new Set(['xml-generate-otp', 'xml-download']);

/**
 * Aadhaar XML OTP generate/download failures unlock DigiLocker.
 * Those 5xxs must not park the lead as INTERNAL_ERROR.
 */
export function isAadhaarXmlOtpFallbackService(serviceName: string | null | undefined): boolean {
  const n = (serviceName ?? '').trim().toLowerCase();
  if (!n) return false;
  if (AADHAAR_XML_OTP_FALLBACK_SERVICES.has(n)) return true;
  return n.includes('xml-generate-otp') || n.includes('xml-download');
}

export function buildVendor5xxNote(params: {
  providerName: string;
  serviceName: string;
  httpStatus: number | null;
  body: unknown;
  transportError?: string;
}): string {
  const apiCode = extractVendorResponseStatusCode(params.body);
  const parts = [`${params.providerName}/${params.serviceName}`];
  if (params.httpStatus != null) parts.push(`HTTP ${params.httpStatus}`);
  if (apiCode != null) parts.push(`api ${apiCode}`);
  if (params.transportError?.trim()) parts.push(params.transportError.trim());
  return parts.join(' · ').slice(0, 256);
}

/** Tenacio auth / header misconfiguration — not a customer selfie quality issue. */
export function isVendorTechnicalConfigurationError(params: {
  message?: string | null;
  httpStatus?: number | null;
}): boolean {
  const msg = (params.message ?? '').trim().toLowerCase();
  if (!msg) return false;

  if (
    msg.includes('invalid x-api-key') ||
    msg.includes('x-api-key') ||
    msg.includes('invalid api key') ||
    msg.includes('invalid client-id') ||
    msg.includes('invalid client id') ||
    msg.includes('header validation')
  ) {
    return true;
  }

  if (params.httpStatus === 401 || params.httpStatus === 403) {
    return (
      msg.includes('x-api-key') ||
      msg.includes('client-id') ||
      msg.includes('client id') ||
      msg.includes('unauthorized') ||
      msg.includes('forbidden')
    );
  }

  return false;
}
