/** When true, customer KYC fails if Tenacio deepfake is not configured (AI/synthetic images cannot be caught locally). */
export function isKycDeepfakeRequired(): boolean {
  const raw = (process.env.KYC_DEEPFAKE_REQUIRED ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
