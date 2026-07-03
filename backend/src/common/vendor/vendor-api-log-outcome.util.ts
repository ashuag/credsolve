import { isTenacioVendorBusinessSuccess } from '../kyc/aadhaar-vendor-parse.util';
import {
  extractVendorServiceError,
  isHttp5xx,
  isVendorApi5xxFailure,
} from './vendor-api-error.util';

export type VendorApiLogOutcome = 'success' | 'failure';

/** Parses `Tenacio/liveness · HTTP 200 · api 505` style lead status notes. */
export function parseVendorServiceFromLeadStatusNote(
  note: string | null | undefined,
): { providerName: string; serviceName: string } | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  const match = /^([^/·\s]+)\/([^·\s]+)/.exec(trimmed);
  if (!match) return null;
  const providerName = match[1].trim();
  const serviceName = match[2].trim();
  if (!providerName || !serviceName) return null;
  return { providerName, serviceName };
}

/**
 * Classifies a persisted `vendor_api_log` row (or live HTTP result) for
 * "last record wins" escalation / recovery decisions.
 */
export function classifyVendorApiLogOutcome(
  httpStatus: number | null,
  responsePayload: unknown,
): VendorApiLogOutcome {
  if (httpStatus == null) return 'failure';
  if (isHttp5xx(httpStatus)) return 'failure';
  if (isVendorApi5xxFailure({ httpStatus, body: responsePayload })) return 'failure';
  if (extractVendorServiceError(responsePayload)) return 'failure';

  if (httpStatus >= 200 && httpStatus < 300) {
    if (responsePayload != null && typeof responsePayload === 'object') {
      const status =
        typeof (responsePayload as { status?: unknown }).status === 'string'
          ? (responsePayload as { status: string }).status.trim().toLowerCase()
          : null;
      if (status === 'error') return 'failure';
      if (status === 'success' || isTenacioVendorBusinessSuccess(responsePayload)) {
        return 'success';
      }
    }
    return 'success';
  }

  return 'failure';
}
