function envTruthy(name: string): boolean {
  const v = String(process.env[name] ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * When truthy, outbound Tenacio liveness is not called. The face step still requires
 * DigiLocker Aadhaar data plus a stored selfie (`GetCustomerSessionUseCase`).
 */
export function isKycLivenessCheckPaused(): boolean {
  return envTruthy('KYC_LIVENESS_PAUSED');
}

/** True when `TENACIO_LIVENESS_URL` is a usable absolute POST URL (scheme required). */
function tenacioLivenessHasFullUrl(): boolean {
  const url = (process.env.TENACIO_LIVENESS_URL ?? '').trim();
  return /^https?:\/\//i.test(url);
}

/** True when `VENDOR_HOST` + non-empty `TENACIO_LIVENESS_SERVICE` can form a POST target. */
function tenacioLivenessHasHostAndService(): boolean {
  const host = (process.env.VENDOR_HOST ?? '').trim();
  const service = (process.env.TENACIO_LIVENESS_SERVICE ?? '').trim();
  return Boolean(host && service);
}

/**
 * When true, `POST .../kyc/liveness` must not call Tenacio; the journey treats a saved selfie as enough
 * (`livenessRequired: false`). Use any of: `KYC_LIVENESS_PAUSED`, `TENACIO_LIVENESS_DISABLED`, clear
 * `TENACIO_LIVENESS_SERVICE` (unless `TENACIO_LIVENESS_URL` is a full https URL), or omit both URL and service.
 */
export function isKycLivenessOutboundSkipped(): boolean {
  if (isKycLivenessCheckPaused()) return true;
  if (envTruthy('TENACIO_LIVENESS_DISABLED')) return true;
  if (!tenacioLivenessHasFullUrl() && !tenacioLivenessHasHostAndService()) return true;
  return false;
}
