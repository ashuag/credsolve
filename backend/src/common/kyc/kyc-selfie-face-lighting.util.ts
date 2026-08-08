import type * as tf from '@tensorflow/tfjs-node';
import type { SelfieFaceBox } from './kyc-selfie-face-validation.util';
import { extractGrayFaceCrop } from './kyc-selfie-face-blur.util';

/**
 * Soft mean floor (0–255). Kept low so deep skin tones in normal indoor light
 * are not rejected as underexposed; crushed/black frames still fail below this.
 */
export const KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE = 32;

/**
 * Fraction of face-crop pixels darker than {@link KYC_SELFIE_DARK_PIXEL_THRESHOLD}.
 * Threshold targets crushed blacks, not dark-skin midtones.
 */
export const KYC_SELFIE_MAX_DARK_PIXEL_RATIO = 0.5;

/**
 * Gray value below which a pixel counts as underexposed (near-black).
 * Previously 48, which incorrectly treated many dark-skin midtones as “dark”.
 */
export const KYC_SELFIE_DARK_PIXEL_THRESHOLD = 20;

/** Minimum luminance std-dev — pitch-black / flat frames fail even if mean is soft. */
export const KYC_SELFIE_MIN_FACE_LUMINANCE_STD = 10;

/**
 * Well-lit faces (including deep skin tones) still show brighter patches
 * (forehead, cheek highlight, glasses catch-light). Used as an alternate pass path.
 */
export const KYC_SELFIE_MIN_HIGHLIGHT_P90 = 50;

export type SelfieFaceLightingMeasurement = {
  meanFaceLuminance: number;
  darkPixelRatio: number;
  luminanceStd: number;
  highlightP90: number;
  minMeanFaceLuminanceRequired: number;
  maxDarkPixelRatioAllowed: number;
  passed: boolean;
};

export function computeFaceLightingStats(gray: ArrayLike<number>): {
  meanFaceLuminance: number;
  darkPixelRatio: number;
  luminanceStd: number;
  highlightP90: number;
} {
  const n = gray.length;
  if (n === 0) {
    return { meanFaceLuminance: 0, darkPixelRatio: 1, luminanceStd: 0, highlightP90: 0 };
  }

  let sum = 0;
  let dark = 0;
  const values = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const v = gray[i] ?? 0;
    values[i] = v;
    sum += v;
    if (v < KYC_SELFIE_DARK_PIXEL_THRESHOLD) dark += 1;
  }

  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < n; i += 1) {
    const d = (values[i] ?? 0) - mean;
    varSum += d * d;
  }
  const luminanceStd = Math.sqrt(varSum / n);

  values.sort((a, b) => a - b);
  const p90Index = Math.min(n - 1, Math.floor(n * 0.9));
  const highlightP90 = values[p90Index] ?? 0;

  return {
    meanFaceLuminance: mean,
    darkPixelRatio: dark / n,
    luminanceStd,
    highlightP90,
  };
}

/**
 * Skin-tone-aware underexposure gate:
 * - Reject crushed blacks (true underexposure)
 * - Allow lower mean luminance when the face still has contrast / highlights
 *   (typical for deep skin tones under normal lighting)
 */
export function validateSelfieFaceLighting(
  meanFaceLuminance: number,
  darkPixelRatio: number,
  minMean: number = KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
  maxDarkRatio: number = KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
  luminanceStd: number = Number.POSITIVE_INFINITY,
  highlightP90: number = Number.POSITIVE_INFINITY,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(meanFaceLuminance) || !Number.isFinite(darkPixelRatio)) {
    return {
      ok: false,
      reason:
        'Face is too dark. Move to brighter lighting, face a light source, and try again.',
    };
  }

  const crushedBlacks = darkPixelRatio > maxDarkRatio;
  const hasFacialLight =
    (Number.isFinite(luminanceStd) && luminanceStd >= KYC_SELFIE_MIN_FACE_LUMINANCE_STD) ||
    (Number.isFinite(highlightP90) && highlightP90 >= KYC_SELFIE_MIN_HIGHLIGHT_P90);
  const tooDimOverall = meanFaceLuminance < minMean && !hasFacialLight;

  if (crushedBlacks || tooDimOverall) {
    return {
      ok: false,
      reason:
        'Face is too dark. Move to brighter lighting, face a light source, and try again.',
    };
  }
  return { ok: true };
}

export function measureSelfieFaceLighting(
  tensor: tf.Tensor3D,
  box: SelfieFaceBox,
): SelfieFaceLightingMeasurement {
  const [imageHeight, imageWidth] = tensor.shape;
  const crop = extractGrayFaceCrop(tensor, box, imageWidth, imageHeight);
  const stats = computeFaceLightingStats(crop.pixels);
  const lighting = validateSelfieFaceLighting(
    stats.meanFaceLuminance,
    stats.darkPixelRatio,
    KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
    KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
    stats.luminanceStd,
    stats.highlightP90,
  );
  return {
    meanFaceLuminance: stats.meanFaceLuminance,
    darkPixelRatio: stats.darkPixelRatio,
    luminanceStd: stats.luminanceStd,
    highlightP90: stats.highlightP90,
    minMeanFaceLuminanceRequired: KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
    maxDarkPixelRatioAllowed: KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
    passed: lighting.ok,
  };
}
