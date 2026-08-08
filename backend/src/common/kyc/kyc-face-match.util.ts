export const KYC_FACE_MATCH_MAX_DISTANCE = resolveFaceMatchMaxDistance();
/** SSD pipeline entry — keep low so backlit webcam / ID photos are found (same as selfie validation). */
export const KYC_FACE_MATCH_MIN_DETECTION_SCORE = 0.1;

export type KycFaceMatchSideResult = {
  faceDetected: boolean;
  detectionScore: number | null;
  imageWidth: number;
  imageHeight: number;
  /** Faces at/above the dual-face confidence gate (may be >1). */
  faceCount: number;
  /** True when 2+ confident faces were found on this side. */
  dualFaceDetected: boolean;
};

export type KycFaceMatchInspection = {
  ok: boolean;
  matchPassed: boolean;
  matchScore: number | null;
  distance: number | null;
  maxDistanceThreshold: number;
  reference: KycFaceMatchSideResult;
  probe: KycFaceMatchSideResult;
  reason?: string;
  productionValidationDisabled: boolean;
};

function resolveFaceMatchMaxDistance(): number {
  const raw = (process.env.KYC_FACE_MATCH_MAX_DISTANCE ?? '').trim();
  if (!raw) return 0.6;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.6;
}

export function isKycFaceMatchDisabled(): boolean {
  const raw = (process.env.KYC_FACE_MATCH_DISABLED ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** Higher score = more similar. Maps euclidean descriptor distance to 0–1. */
export function distanceToMatchScore(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}

export function evaluateFaceMatch(
  distance: number,
  maxDistance = KYC_FACE_MATCH_MAX_DISTANCE,
): { matchPassed: boolean; matchScore: number } {
  return {
    matchPassed: distance <= maxDistance,
    matchScore: distanceToMatchScore(distance),
  };
}

export function emptyFaceMatchInspection(reason: string): KycFaceMatchInspection {
  return {
    ok: false,
    matchPassed: false,
    matchScore: null,
    distance: null,
    maxDistanceThreshold: KYC_FACE_MATCH_MAX_DISTANCE,
    reference: emptySide(),
    probe: emptySide(),
    reason,
    productionValidationDisabled: isKycFaceMatchDisabled(),
  };
}

function emptySide(): KycFaceMatchSideResult {
  return {
    faceDetected: false,
    detectionScore: null,
    imageWidth: 0,
    imageHeight: 0,
    faceCount: 0,
    dualFaceDetected: false,
  };
}
