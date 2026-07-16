/** Display order for the MoneyCash KYC face pipeline (customer selfie step). */
export const KYC_FACE_PIPELINE_STEPS = [
  { key: '1.1', label: 'Take selfie' },
  { key: '1.2', label: 'Selfie quality (MoneyCash)' },
  { key: '2', label: 'Aadhaar face match (MoneyCash)' },
  // TEMP paused — resume later:
  // { key: '3', label: 'Expression anti-spoof' },
  // { key: '4', label: 'Active liveness (MoneyCash)' },
] as const;
