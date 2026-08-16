import { authorizedLosRequest } from './_shared';

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
    faceCount?: number;
    dualFaceDetected?: boolean;
  };
  probe: {
    faceDetected: boolean;
    detectionScore: number | null;
    imageWidth: number;
    imageHeight: number;
    faceCount?: number;
    dualFaceDetected?: boolean;
  };
  reason?: string;
  productionValidationDisabled: boolean;
};

export type PhotoQualityChecks = {
  /** False for Aadhaar / ID — quality and liveness are not applied. */
  qualityChecksApplied: boolean;
  blurPassed: boolean | null;
  lightingPassed: boolean | null;
  eyesOpenPassed: boolean | null;
  faceNotMaskedPassed: boolean | null;
  aiModifiedPassed: boolean | null;
  passiveLivenessPassed: boolean | null;
  identityMatchPassed: boolean | null;
  fullFaceDetected: boolean;
  faceNotCovered: boolean;
  /** True when 2+ qualifying faces were detected. */
  dualFaceDetected: boolean;
  /** Qualifying face count used for dual-face / single-person checks. */
  faceCount: number;
  qualityScore: number | null;
  ok: boolean;
  reason?: string;
  inspection: {
    ok: boolean;
    reason?: string;
    imageWidth: number;
    imageHeight: number;
    bestComputedConfidence: number | null;
    minComputedConfidenceRequired?: number;
    laplacianVariance: number | null;
    minLaplacianVarianceRequired: number;
    blurPassed: boolean | null;
    meanFaceLuminance: number | null;
    darkPixelRatio: number | null;
    luminanceStd?: number | null;
    highlightP90?: number | null;
    minMeanFaceLuminanceRequired?: number;
    maxDarkPixelRatioAllowed?: number;
    lightingPassed: boolean | null;
    eyesOpenPassed?: boolean | null;
    eyeAspectRatio?: number | null;
    faceNotMaskedPassed?: boolean | null;
    aiModifiedPassed?: boolean | null;
    rawDetectionCount: number;
    qualifyingDetectionCount: number;
  };
};

/** @deprecated Use {@link PhotoQualityChecks}. */
export type ProbeQualityChecks = PhotoQualityChecks;

export type LosFaceMatchCheckResult = {
  referenceQuality: PhotoQualityChecks;
  probeQuality: PhotoQualityChecks;
  local: KycFaceMatchLocalResult | null;
  businessOk: boolean;
};

/** Dry-run: selfie quality + liveness gates, then Aadhaar↔selfie face match via local face-api. */
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
