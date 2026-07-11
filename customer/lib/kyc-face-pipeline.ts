/** Display order for the MoneyCash KYC face pipeline (matches LOS). */
export const KYC_FACE_PIPELINE_STEPS = [
  'Selfie quality (MoneyCash)',
  'Aadhaar face match (MoneyCash)',
  'Expression anti-spoof',
  'Active liveness (MoneyCash)',
] as const;
