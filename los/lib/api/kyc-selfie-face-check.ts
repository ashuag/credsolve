import { authorizedLosRequest } from './_shared';
import type { KycSelfieFaceLocalResult, LosTenacioDryRunResult } from './kyc-tenacio-checks';

export type KycSelfieFaceCheckDetection = {
  score: number;
  box: { x: number; y: number; width: number; height: number };
  landmarks: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    noseTip: { x: number; y: number };
    mouthCenter: { x: number; y: number };
  };
  confidence?: {
    detection: number;
    faceSize: number;
    landmarkAlignment: number;
    featureSpacing: number;
    computed: number;
  };
};

export type KycSelfieFaceCheckLocalResult = KycSelfieFaceLocalResult & {
  confidenceBreakdown: KycSelfieFaceCheckDetection['confidence'] | null;
  minFaceAreaRatio: number;
  detections: KycSelfieFaceCheckDetection[];
};

export type LosSelfieFaceCheckResult = {
  local: KycSelfieFaceCheckLocalResult;
  tenacio: LosTenacioDryRunResult | null;
  businessOk: boolean;
};

/** @deprecated Use `LosSelfieFaceCheckResult` — kept for older imports. */
export type KycSelfieFaceCheckResult = KycSelfieFaceCheckLocalResult;

export async function runKycSelfieFaceCheck(
  token: string,
  file: File,
): Promise<LosSelfieFaceCheckResult> {
  const form = new FormData();
  form.set('selfie', file, file.name || 'selfie.jpg');
  return authorizedLosRequest<LosSelfieFaceCheckResult>(
    token,
    '/developer-tools/kyc-selfie-face-check',
    { method: 'POST', body: form },
    'Selfie face check failed.',
  );
}
