export const KYC_FACE_MATCH_MAX_DISTANCE = resolveFaceMatchMaxDistance();
/** SSD pipeline entry — keep low so backlit webcam / ID photos are found (same as selfie validation). */
export const KYC_FACE_MATCH_MIN_DETECTION_SCORE = 0.1;

/**
 * DigiLocker Aadhaar photos are commonly tiny already-cropped faces (~160x200px). SSD
 * MobileNetv1 processes images at native resolution rather than a fixed internal canvas, so
 * naive upscaling rarely changes detection quality (verified against real stored Aadhaar
 * samples — scores came back unchanged, occasionally slightly worse, never meaningfully
 * better). This size only feeds an opportunistic retry: when the *original* detection is weak
 * or missing, we also try this larger size and keep whichever result scored higher, so a retry
 * can never make an already-good detection worse.
 */
export const KYC_FACE_MATCH_MIN_DETECTION_SIDE_PX = 400;

/**
 * Returns the `[height, width]` to retry detection at so the image's shorter side reaches
 * {@link KYC_FACE_MATCH_MIN_DETECTION_SIDE_PX}, or `null` when the image is already large enough.
 */
export function computeDetectionUpscaleSize(
  height: number,
  width: number,
  minShortSide = KYC_FACE_MATCH_MIN_DETECTION_SIDE_PX,
): [number, number] | null {
  const shortSide = Math.min(height, width);
  if (!shortSide || shortSide >= minShortSide) return null;
  const scale = minShortSide / shortSide;
  return [Math.round(height * scale), Math.round(width * scale)];
}

/**
 * DigiLocker Aadhaar photos vary widely in quality and the customer cannot retake them. Measured
 * against real stored samples, the descriptor distance for the *same genuine person* creeps
 * upward as the reference photo's own detection confidence drops (e.g. ~0.51 at a clean 0.998
 * confidence scan vs ~0.56 at a degraded ~0.33 confidence scan, against a 0.6 cutoff) — so a
 * low-quality-but-genuine ID photo can tip a legitimate customer into a false reject. When the
 * reference photo's detection confidence is below {@link KYC_FACE_MATCH_LOW_QUALITY_REFERENCE_SCORE},
 * allow a small bounded extra distance tolerance. Both knobs are env-tunable since this is a
 * fraud-tolerance tradeoff, not a pure engineering one.
 */
export const KYC_FACE_MATCH_LOW_QUALITY_REFERENCE_SCORE = resolveLowQualityReferenceScore();
export const KYC_FACE_MATCH_LOW_QUALITY_RELAXATION = resolveLowQualityRelaxation();

function resolveLowQualityReferenceScore(): number {
  const raw = (process.env.KYC_FACE_MATCH_LOW_QUALITY_REFERENCE_SCORE ?? '').trim();
  if (!raw) return 0.85;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1 ? parsed : 0.85;
}

function resolveLowQualityRelaxation(): number {
  const raw = (process.env.KYC_FACE_MATCH_LOW_QUALITY_RELAXATION ?? '').trim();
  if (!raw) return 0.05;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.05;
}

/**
 * The distance threshold to apply for this comparison: the base threshold, or a bounded relaxed
 * threshold when the reference (ID) photo's own detection confidence signals a low-quality scan.
 */
export function resolveEffectiveMaxDistance(
  referenceDetectionScore: number | null,
  baseMax = KYC_FACE_MATCH_MAX_DISTANCE,
  lowQualityScoreThreshold = KYC_FACE_MATCH_LOW_QUALITY_REFERENCE_SCORE,
  relaxation = KYC_FACE_MATCH_LOW_QUALITY_RELAXATION,
): number {
  if (referenceDetectionScore == null || referenceDetectionScore >= lowQualityScoreThreshold) {
    return baseMax;
  }
  return baseMax + relaxation;
}

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
