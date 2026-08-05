/** Parse persisted selfie-face validation JSON for LOS historical display (execution stack removed). */

const KYC_SELFIE_MIN_LAPLACIAN_VARIANCE = 80;

export type PersistedSelfieFaceValidation = {
  passed: boolean;
  checkedAt: string | null;
  bestComputedConfidence: number | null;
  topDetectionScore: number | null;
  reason: string | null;
  laplacianVariance: number | null;
  minLaplacianVarianceRequired: number;
  blurPassed: boolean | null;
  confidenceBreakdown: {
    detection: number;
    faceSize: number;
    landmarkAlignment: number;
    featureSpacing: number;
    computed: number;
  } | null;
};

export function parsePersistedSelfieFaceValidation(
  json: unknown,
  passedFlag: boolean,
  checkedAt: Date | null,
): PersistedSelfieFaceValidation | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    if (!checkedAt && !passedFlag) return null;
    return {
      passed: passedFlag,
      checkedAt: checkedAt?.toISOString() ?? null,
      bestComputedConfidence: null,
      topDetectionScore: null,
      reason: null,
      laplacianVariance: null,
      minLaplacianVarianceRequired: KYC_SELFIE_MIN_LAPLACIAN_VARIANCE,
      blurPassed: null,
      confidenceBreakdown: null,
    };
  }

  const row = json as Record<string, unknown>;
  const breakdown = row.confidenceBreakdown;
  let confidenceBreakdown: PersistedSelfieFaceValidation['confidenceBreakdown'] = null;
  if (breakdown && typeof breakdown === 'object' && !Array.isArray(breakdown)) {
    const b = breakdown as Record<string, unknown>;
    confidenceBreakdown = {
      detection: Number(b.detection) || 0,
      faceSize: Number(b.faceSize) || 0,
      landmarkAlignment: Number(b.landmarkAlignment) || 0,
      featureSpacing: Number(b.featureSpacing) || 0,
      computed: Number(b.computed) || 0,
    };
  }

  return {
    passed: typeof row.ok === 'boolean' ? row.ok : passedFlag,
    checkedAt:
      (typeof row.checkedAt === 'string' ? row.checkedAt : null) ?? checkedAt?.toISOString() ?? null,
    bestComputedConfidence:
      typeof row.bestComputedConfidence === 'number' ? row.bestComputedConfidence : null,
    topDetectionScore: typeof row.topDetectionScore === 'number' ? row.topDetectionScore : null,
    reason: typeof row.reason === 'string' ? row.reason : null,
    laplacianVariance: typeof row.laplacianVariance === 'number' ? row.laplacianVariance : null,
    minLaplacianVarianceRequired:
      typeof row.minLaplacianVarianceRequired === 'number'
        ? row.minLaplacianVarianceRequired
        : KYC_SELFIE_MIN_LAPLACIAN_VARIANCE,
    blurPassed: typeof row.blurPassed === 'boolean' ? row.blurPassed : null,
    confidenceBreakdown,
  };
}
