/**
 * When truthy, outbound Tenacio liveness is not called. The face step still requires
 * DigiLocker Aadhaar data plus a stored selfie (`GetCustomerSessionUseCase`).
 */
export function isKycLivenessCheckPaused(): boolean {
  const v = (process.env.KYC_LIVENESS_PAUSED ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
