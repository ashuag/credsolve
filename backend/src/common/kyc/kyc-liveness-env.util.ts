function envTruthy(name: string): boolean {
  const v = String(process.env[name] ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * When truthy, KYC cannot complete unless the active-liveness head-movement recording scored a pass.
 * Off by default so applications started before the head-movement step can still finish.
 */
export function isKycHeadMovementRequired(): boolean {
  return envTruthy('KYC_HEAD_MOVEMENT_REQUIRED');
}
