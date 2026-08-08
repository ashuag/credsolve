import type { Prisma } from '@prisma/client';
import type { KycSelfieFaceInspection } from './kyc-selfie-face-validation.util';
import { KYC_SELFIE_MIN_LAPLACIAN_VARIANCE } from './kyc-selfie-face-blur.util';
import {
  KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
  KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
} from './kyc-selfie-face-lighting.util';

export const KYC_SELFIE_FACE_RETRY_HINT =
  'Please try one more time — keep your full face visible and do not cover your eyes, nose, or mouth.';

export function toPersistedSelfieFaceInspection(
  inspection: KycSelfieFaceInspection,
): Prisma.InputJsonObject {
  const topScore =
    inspection.detections.length > 0
      ? Math.max(...inspection.detections.map((d) => d.score))
      : null;

  return {
    ok: inspection.ok,
    reason: inspection.reason ?? null,
    bestComputedConfidence: inspection.bestComputedConfidence,
    confidenceBreakdown: inspection.confidenceBreakdown,
    minComputedConfidenceRequired: inspection.minComputedConfidenceRequired,
    minConfidenceRequired: inspection.minConfidenceRequired,
    rawDetectionCount: inspection.rawDetectionCount,
    qualifyingDetectionCount: inspection.qualifyingDetectionCount,
    imageWidth: inspection.imageWidth,
    imageHeight: inspection.imageHeight,
    laplacianVariance: inspection.laplacianVariance,
    minLaplacianVarianceRequired: inspection.minLaplacianVarianceRequired,
    blurPassed: inspection.blurPassed,
    meanFaceLuminance: inspection.meanFaceLuminance,
    darkPixelRatio: inspection.darkPixelRatio,
    luminanceStd: inspection.luminanceStd,
    highlightP90: inspection.highlightP90,
    minMeanFaceLuminanceRequired: inspection.minMeanFaceLuminanceRequired,
    maxDarkPixelRatioAllowed: inspection.maxDarkPixelRatioAllowed,
    lightingPassed: inspection.lightingPassed,
    topDetectionScore: topScore,
    checkedAt: new Date().toISOString(),
  };
}

export type PersistedSelfieFaceValidation = {
  passed: boolean;
  checkedAt: string | null;
  bestComputedConfidence: number | null;
  topDetectionScore: number | null;
  reason: string | null;
  laplacianVariance: number | null;
  minLaplacianVarianceRequired: number;
  blurPassed: boolean | null;
  meanFaceLuminance: number | null;
  darkPixelRatio: number | null;
  minMeanFaceLuminanceRequired: number;
  maxDarkPixelRatioAllowed: number;
  lightingPassed: boolean | null;
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
      meanFaceLuminance: null,
      darkPixelRatio: null,
      minMeanFaceLuminanceRequired: KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
      maxDarkPixelRatioAllowed: KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
      lightingPassed: null,
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
    meanFaceLuminance: typeof row.meanFaceLuminance === 'number' ? row.meanFaceLuminance : null,
    darkPixelRatio: typeof row.darkPixelRatio === 'number' ? row.darkPixelRatio : null,
    minMeanFaceLuminanceRequired:
      typeof row.minMeanFaceLuminanceRequired === 'number'
        ? row.minMeanFaceLuminanceRequired
        : KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
    maxDarkPixelRatioAllowed:
      typeof row.maxDarkPixelRatioAllowed === 'number'
        ? row.maxDarkPixelRatioAllowed
        : KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
    lightingPassed: typeof row.lightingPassed === 'boolean' ? row.lightingPassed : null,
    confidenceBreakdown,
  };
}
