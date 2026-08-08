function envTruthy(name: string): boolean {
  const v = String(process.env[name] ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * When truthy, outbound Tenacio liveness is not called.
 * Local MoneyCash Aadhaar↔selfie face match still runs and must pass before KYC completes.
 */
export function isKycLivenessCheckPaused(): boolean {
  return envTruthy('KYC_LIVENESS_PAUSED');
}

/**
 * When truthy, KYC cannot complete unless the active-liveness head-movement recording scored a pass.
 * Off by default so applications started before the head-movement step can still finish.
 */
export function isKycHeadMovementRequired(): boolean {
  return envTruthy('KYC_HEAD_MOVEMENT_REQUIRED');
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
 * When true, `POST .../kyc/liveness` skips the Tenacio vendor call after local face match passes.
 * Does **not** skip DigiLocker Aadhaar↔selfie face match — that remains required for KYC.
 */
export function isKycLivenessOutboundSkipped(): boolean {
  if (isKycLivenessCheckPaused()) return true;
  if (envTruthy('TENACIO_LIVENESS_DISABLED')) return true;
  if (!tenacioLivenessHasFullUrl() && !tenacioLivenessHasHostAndService()) return true;
  return false;
}
