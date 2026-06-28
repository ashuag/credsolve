import { authorizedLosRequest } from './_shared';

export type LosTenacioDryRunResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  vendorErrorMessage?: string;
  businessOk: boolean;
  summary: {
    matchScore?: number | null;
    matchPassed?: boolean | null;
    deepfakeDetected?: boolean | null;
    authenticityScore?: number | null;
    livenessScore?: number | null;
    isLive?: boolean | null;
    multipleFacesDetected?: boolean | null;
    faceOccluded?: boolean | null;
    referenceStoredAs?: string;
    probeStoredAs?: string;
    imageStoredAs?: string;
  };
};

export type FaceMatchCheckPayload = {
  reference?: File;
  probe?: File;
  referenceUrl?: string;
  probeUrl?: string;
};

export type KycFaceMatchLocalResult = {
  ok: boolean;
  matchPassed: boolean;
  matchScore: number | null;
  distance: number | null;
  maxDistanceThreshold: number;
  reference: {
    faceDetected: boolean;
    detectionScore: number | null;
    imageWidth: number;
    imageHeight: number;
  };
  probe: {
    faceDetected: boolean;
    detectionScore: number | null;
    imageWidth: number;
    imageHeight: number;
  };
  reason?: string;
  productionValidationDisabled: boolean;
};

export type LosFaceMatchCheckResult = {
  local: KycFaceMatchLocalResult;
  tenacio: LosTenacioDryRunResult | null;
  businessOk: boolean;
};

export type KycSelfieFaceLocalResult = {
  ok: boolean;
  reason?: string;
  productionValidationDisabled: boolean;
  imageWidth: number;
  imageHeight: number;
  minConfidenceRequired: number;
  minComputedConfidenceRequired: number;
  bestComputedConfidence: number | null;
  laplacianVariance: number | null;
  minLaplacianVarianceRequired: number;
  blurPassed: boolean | null;
  rawDetectionCount: number;
  qualifyingDetectionCount: number;
};

export type LosDeepfakeCheckResult = {
  local: KycSelfieFaceLocalResult;
  tenacio: LosTenacioDryRunResult | null;
  businessOk: boolean;
};

export async function runKycFaceMatchCheck(
  token: string,
  payload: FaceMatchCheckPayload,
): Promise<LosFaceMatchCheckResult> {
  const form = new FormData();
  if (payload.reference) {
    form.set('reference', payload.reference, payload.reference.name || 'reference.jpg');
  }
  if (payload.probe) {
    form.set('probe', payload.probe, payload.probe.name || 'probe.jpg');
  }
  const referenceUrl = payload.referenceUrl?.trim();
  const probeUrl = payload.probeUrl?.trim();
  if (referenceUrl) form.set('referenceUrl', referenceUrl);
  if (probeUrl) form.set('probeUrl', probeUrl);
  return authorizedLosRequest(
    token,
    '/developer-tools/kyc-face-match-check',
    { method: 'POST', body: form },
    'Face match check failed.',
  );
}

export async function runKycDeepfakeCheck(token: string, image: File): Promise<LosDeepfakeCheckResult> {
  const form = new FormData();
  form.set('image', image, image.name || 'image.jpg');
  return authorizedLosRequest(
    token,
    '/developer-tools/kyc-deepfake-check',
    { method: 'POST', body: form },
    'Deepfake check failed.',
  );
}
