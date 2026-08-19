import {
  extractVendorResponseStatusCode,
  extractVendorServiceError,
} from './vendor-api-error.util';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function collectPennyDropVendorMessage(vendor: unknown): string {
  const err = extractVendorServiceError(vendor);
  const parts: string[] = [];
  if (err?.message) parts.push(err.message);

  if (isRecord(vendor)) {
    const serviceError = isRecord(vendor.serviceError) ? vendor.serviceError : null;
    if (serviceError && typeof serviceError.message === 'string') {
      parts.push(serviceError.message);
    }
    if (typeof vendor.message === 'string') parts.push(vendor.message);
  }

  return parts.join(' ').trim();
}

/**
 * Tenacio penny-drop envelopes such as:
 * `{ status: "error", serviceStatusCode: 400, serviceError: { message: "Invalid Input" } }`
 * or messages about attempts exceeded / retry limit.
 */
export function isPennyDropInvalidInputOrAttemptLimit(vendor: unknown): boolean {
  const err = extractVendorServiceError(vendor);
  const code = err?.serviceStatusCode ?? extractVendorResponseStatusCode(vendor);
  const msg = collectPennyDropVendorMessage(vendor).toLowerCase();

  if (code === 400) return true;
  if (msg.includes('invalid input')) return true;
  if (msg.includes('attempts exceeded') || msg.includes('reach it') || msg.includes('retry limit')) {
    return true;
  }
  return false;
}

export function pennyDropVendorFailMessage(vendor: unknown): string | undefined {
  const msg = collectPennyDropVendorMessage(vendor);
  return msg.length > 0 ? msg : undefined;
}
