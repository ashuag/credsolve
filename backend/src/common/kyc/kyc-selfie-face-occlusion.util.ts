import type * as tf from '@tensorflow/tfjs-node';
import { extractGrayFaceCrop } from './kyc-selfie-face-blur.util';
import type { SelfieFaceBox, SelfieFaceLandmarkPoint } from './kyc-selfie-face-validation.util';

/** Typical 68-point EAR; below this the eyes look closed. */
export const KYC_SELFIE_MIN_EYE_ASPECT_RATIO = 0.18;

/** Mouth vertical span vs inter-eye distance; smaller suggests a mask. */
export const KYC_SELFIE_MIN_MOUTH_TO_EYE_RATIO = 0.1;

function dist(a: SelfieFaceLandmarkPoint, b: SelfieFaceLandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(eye: SelfieFaceLandmarkPoint[]): number | null {
  if (eye.length < 6) return null;
  const p1 = eye[0]!;
  const p2 = eye[1]!;
  const p3 = eye[2]!;
  const p4 = eye[3]!;
  const p5 = eye[4]!;
  const p6 = eye[5]!;
  const horizontal = dist(p1, p4);
  if (horizontal < 1) return null;
  return (dist(p2, p6) + dist(p3, p5)) / (2 * horizontal);
}

export function evaluateSelfieEyesOpen(params: {
  leftEyeContour?: SelfieFaceLandmarkPoint[];
  rightEyeContour?: SelfieFaceLandmarkPoint[];
}): { eyesOpenPassed: boolean | null; eyeAspectRatio: number | null } {
  const left = eyeAspectRatio(params.leftEyeContour ?? []);
  const right = eyeAspectRatio(params.rightEyeContour ?? []);
  const values = [left, right].filter((v): v is number => v != null);
  if (!values.length) {
    return { eyesOpenPassed: null, eyeAspectRatio: null };
  }
  const ear = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    eyeAspectRatio: ear,
    eyesOpenPassed: ear >= KYC_SELFIE_MIN_EYE_ASPECT_RATIO,
  };
}

export function evaluateSelfieMouthVisible(params: {
  leftEye: SelfieFaceLandmarkPoint;
  rightEye: SelfieFaceLandmarkPoint;
  mouthContour?: SelfieFaceLandmarkPoint[];
}): { faceNotMaskedPassed: boolean | null } {
  const mouth = params.mouthContour ?? [];
  if (mouth.length < 4) return { faceNotMaskedPassed: null };
  const eyeDist = dist(params.leftEye, params.rightEye);
  if (eyeDist < 1) return { faceNotMaskedPassed: null };
  const ys = mouth.map((p) => p.y);
  const mouthHeight = Math.max(...ys) - Math.min(...ys);
  return {
    faceNotMaskedPassed: mouthHeight / eyeDist >= KYC_SELFIE_MIN_MOUTH_TO_EYE_RATIO,
  };
}

/**
 * Minimum row-averaged vertical gradient (0-255 scale) required somewhere in the middle band of
 * the mouth crop to count as a real lip seam. Calibrated against one real stored selfie: the
 * genuine mouth measured ~22.1, and the same mouth region with a synthetic skin-toned covering
 * painted over it (matched to the surrounding skin tone, i.e. the hardest case — a hand of
 * similar tone) measured ~2.4. Set with margin on both sides of that single sample; this is a
 * best-effort heuristic tuned on limited data, not a trained classifier — expect to retune as
 * more real examples surface.
 */
export const KYC_SELFIE_MIN_LIP_SEAM_STRENGTH = 10;

/** Downscaled mouth-crop width used for the lip-seam pixel check. */
export const KYC_SELFIE_MOUTH_CROP_MAX_WIDTH = 80;

/**
 * face-api's landmark model still predicts a plausible mouth shape even when the mouth is
 * physically covered (by a hand, mask, etc.) — it has no occlusion awareness, so geometry-only
 * checks like {@link evaluateSelfieMouthVisible} cannot detect this. A real mouth, open or
 * closed, has a lip seam: a natural crease/shadow line where the lips meet, which shows up as a
 * localized band of vertical gradient roughly at the landmark-predicted mouth's vertical center.
 * A hand or cloth covering that region is comparatively smooth there (or has creases not aligned
 * with the expected seam position), so this looks for that specific signal in the actual pixels
 * rather than trusting the landmark geometry.
 *
 * This is a best-effort heuristic, not a trained classifier: expect it to miss some coverings
 * (e.g. very textured hand skin) and to occasionally read a very smooth, evenly-lit closed mouth
 * as covered. It complements, but does not replace, {@link evaluateSelfieMouthVisible}.
 */
export function evaluateSelfieMouthOcclusionFromPixels(params: {
  tensor: tf.Tensor3D;
  mouthContour?: SelfieFaceLandmarkPoint[];
  imageWidth: number;
  imageHeight: number;
}): { faceNotMaskedPassed: boolean | null; lipSeamStrength: number | null } {
  const mouth = params.mouthContour ?? [];
  if (mouth.length < 4) return { faceNotMaskedPassed: null, lipSeamStrength: null };

  const xs = mouth.map((p) => p.x);
  const ys = mouth.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const mouthWidth = maxX - minX;
  const mouthHeight = maxY - minY;
  if (mouthWidth < 1 || mouthHeight < 1) return { faceNotMaskedPassed: null, lipSeamStrength: null };

  // Pad generously — face-api's mouth contour tends to hug the outer lip line, and the seam can
  // sit close to that edge.
  const padX = mouthWidth * 0.25;
  const padY = mouthHeight * 0.6;
  const box: SelfieFaceBox = {
    x: minX - padX,
    y: minY - padY,
    width: mouthWidth + padX * 2,
    height: mouthHeight + padY * 2,
  };

  const crop = extractGrayFaceCrop(
    params.tensor,
    box,
    params.imageWidth,
    params.imageHeight,
    KYC_SELFIE_MOUTH_CROP_MAX_WIDTH,
  );
  if (crop.width < 5 || crop.height < 5) {
    return { faceNotMaskedPassed: null, lipSeamStrength: null };
  }

  const bandStart = Math.max(1, Math.floor(crop.height * 0.3));
  const bandEnd = Math.min(crop.height - 1, Math.ceil(crop.height * 0.7));
  let maxRowGradient = 0;
  for (let y = bandStart; y < bandEnd; y += 1) {
    let rowGradient = 0;
    for (let x = 0; x < crop.width; x += 1) {
      const above = crop.pixels[(y - 1) * crop.width + x] ?? 0;
      const below = crop.pixels[(y + 1) * crop.width + x] ?? 0;
      rowGradient += Math.abs(below - above);
    }
    rowGradient /= crop.width;
    if (rowGradient > maxRowGradient) maxRowGradient = rowGradient;
  }

  return {
    lipSeamStrength: maxRowGradient,
    faceNotMaskedPassed: maxRowGradient >= KYC_SELFIE_MIN_LIP_SEAM_STRENGTH,
  };
}

/**
 * Minimum pupil-darkness (center-of-eye local minimum below the center-of-eye mean, 0-255 scale)
 * required to count as genuinely open. Calibrated against one real stored selfie: real open eyes
 * measured ~27.1-43.9, and the same eyes with a synthetic skin-toned covering painted over them
 * (simulating fully closed/smooth eyelids) measured ~2.8-2.9. Set with wide margin below the
 * real range; best-effort heuristic tuned on limited data.
 *
 * This intentionally only looks at the *center* of the eye crop (not the full crop) so that
 * eyeglass frame edges and lens glare — which sit near the crop's boundary, not over the pupil
 * itself — don't get mistaken for eye contrast. It is still a heuristic: strong lens reflections
 * that happen to fall in the center, or very dark tinted lenses, can still confuse it.
 */
export const KYC_SELFIE_MIN_EYE_PUPIL_DARKNESS = 12;

/** Downscaled eye-crop width used for the pixel-based eyes-open check. */
export const KYC_SELFIE_EYE_CROP_MAX_WIDTH = 60;

/**
 * face-api's landmark model still predicts a plausible eye-contour shape even when the eyes are
 * shut — same structural blind spot as the mouth check — and eyeglasses (frame edges, glare,
 * tint) further destabilize the eyelid landmarks the geometric EAR check ({@link
 * evaluateSelfieEyesOpen}) relies on. An open eye has a distinctly dark pupil/iris near its
 * center, notably darker than the surrounding sclera/skin; a closed eye is a comparatively
 * smooth, flat expanse of eyelid skin with no such dark spot. This checks for that directly in
 * the actual pixels instead of trusting landmark geometry alone.
 */
export function evaluateSelfieEyesOpenFromPixels(params: {
  tensor: tf.Tensor3D;
  leftEyeContour?: SelfieFaceLandmarkPoint[];
  rightEyeContour?: SelfieFaceLandmarkPoint[];
  imageWidth: number;
  imageHeight: number;
}): { eyesOpenPassed: boolean | null; eyePupilDarkness: number | null } {
  const values = [params.leftEyeContour, params.rightEyeContour]
    .map((contour) => measureEyePupilDarkness(params.tensor, contour, params.imageWidth, params.imageHeight))
    .filter((v): v is number => v != null);
  if (!values.length) return { eyesOpenPassed: null, eyePupilDarkness: null };
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    eyePupilDarkness: avg,
    eyesOpenPassed: avg >= KYC_SELFIE_MIN_EYE_PUPIL_DARKNESS,
  };
}

function measureEyePupilDarkness(
  tensor: tf.Tensor3D,
  contour: SelfieFaceLandmarkPoint[] | undefined,
  imageWidth: number,
  imageHeight: number,
): number | null {
  const points = contour ?? [];
  if (points.length < 4) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 1 || h < 1) return null;
  const padX = w * 0.15;
  const padY = h * 0.5;
  const box: SelfieFaceBox = { x: minX - padX, y: minY - padY, width: w + padX * 2, height: h + padY * 2 };
  const crop = extractGrayFaceCrop(tensor, box, imageWidth, imageHeight, KYC_SELFIE_EYE_CROP_MAX_WIDTH);
  if (crop.width < 4 || crop.height < 4) return null;

  // Only the central 50% both ways — glasses frames and lens edges typically sit near the crop
  // boundary, not over the pupil.
  const xStart = Math.floor(crop.width * 0.25);
  const xEnd = Math.ceil(crop.width * 0.75);
  const yStart = Math.floor(crop.height * 0.25);
  const yEnd = Math.ceil(crop.height * 0.75);

  let min = 255;
  let sum = 0;
  let n = 0;
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const v = crop.pixels[y * crop.width + x] ?? 255;
      if (v < min) min = v;
      sum += v;
      n += 1;
    }
  }
  if (n === 0) return null;
  const mean = sum / n;
  return mean - min;
}

/** AND-combines two nullable pass/fail signals: fails if either fails, passes only if neither failed and at least one has an opinion. */
export function combineFaceChecks(...values: Array<boolean | null>): boolean | null {
  if (values.some((v) => v === false)) return false;
  if (values.every((v) => v == null)) return null;
  return true;
}

/**
 * Conservative still-image flag for over-smoothed / plastic faces (possible AI edit).
 * Only fails extreme uniformity that is not already a lighting crush.
 */
export function evaluateSelfieAiModified(params: {
  luminanceStd: number | null;
  meanFaceLuminance: number | null;
  blurPassed: boolean | null;
}): { aiModifiedPassed: boolean | null } {
  const { luminanceStd, meanFaceLuminance, blurPassed } = params;
  if (luminanceStd == null || meanFaceLuminance == null || blurPassed == null) {
    return { aiModifiedPassed: null };
  }
  const unnaturallyFlat = blurPassed && meanFaceLuminance >= 50 && luminanceStd < 5;
  return { aiModifiedPassed: !unnaturallyFlat };
}
