import type { SelfieFaceBox, SelfieFaceDetectionInput } from './kyc-selfie-face-validation.util';
import {
  KYC_SELFIE_MIN_FACE_AREA_RATIO,
} from './kyc-selfie-face-validation.util';

/** Target face area as a fraction of the image (well-framed selfie). */
const IDEAL_FACE_AREA_RATIO = 0.14;

const MAX_EYE_LEVEL_DELTA_RATIO = 0.3;
const MIN_NOSE_TO_MOUTH_RATIO = 0.12;
const MAX_NOSE_TO_MOUTH_RATIO = 0.75;
/** Typical nose-to-mouth distance / eye distance for an unobstructed frontal face. */
const IDEAL_NOSE_TO_MOUTH_RATIO = 0.33;

export type SelfieFaceConfidenceBreakdown = {
  /** Raw SSD MobileNet face-detection score (0–1). */
  detection: number;
  /** How well the face fills the frame (0–1). */
  faceSize: number;
  /** Eyes above nose above mouth, level eyes (0–1). */
  landmarkAlignment: number;
  /** Nose–mouth spacing vs expected geometry; low when mouth/nose is occluded (0–1). */
  featureSpacing: number;
  /** Weighted aggregate; also capped by detection so weak detector scores cannot read as high confidence. */
  computed: number;
};

const WEIGHTS = {
  detection: 0.35,
  faceSize: 0.15,
  landmarkAlignment: 0.25,
  featureSpacing: 0.25,
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function scoreFaceSize(box: SelfieFaceBox, imageWidth: number, imageHeight: number): number {
  const imageArea = imageWidth * imageHeight;
  if (!Number.isFinite(imageArea) || imageArea <= 0) return 0;
  const ratio = (box.width * box.height) / imageArea;
  if (ratio < KYC_SELFIE_MIN_FACE_AREA_RATIO) {
    return clamp01(ratio / KYC_SELFIE_MIN_FACE_AREA_RATIO) * 0.5;
  }
  return clamp01(ratio / IDEAL_FACE_AREA_RATIO);
}

function scoreLandmarkAlignment(landmarks: SelfieFaceDetectionInput['landmarks']): number {
  const { leftEye, rightEye, noseTip, mouthCenter } = landmarks;
  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  if (!Number.isFinite(eyeDist) || eyeDist < 8) return 0;

  const eyeY = (leftEye.y + rightEye.y) / 2;
  let score = 1;

  if (!(eyeY < noseTip.y && noseTip.y < mouthCenter.y)) {
    score *= 0.15;
  }

  const eyeTilt = Math.abs(leftEye.y - rightEye.y) / eyeDist;
  const eyeLevel = clamp01(1 - eyeTilt / MAX_EYE_LEVEL_DELTA_RATIO);
  score *= 0.5 + 0.5 * eyeLevel;

  return clamp01(score);
}

function scoreFeatureSpacing(landmarks: SelfieFaceDetectionInput['landmarks']): number {
  const { leftEye, rightEye, noseTip, mouthCenter } = landmarks;
  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  if (!Number.isFinite(eyeDist) || eyeDist < 8) return 0;

  const noseToMouth = Math.hypot(noseTip.x - mouthCenter.x, noseTip.y - mouthCenter.y);
  const ratio = noseToMouth / eyeDist;

  if (ratio < MIN_NOSE_TO_MOUTH_RATIO || ratio > MAX_NOSE_TO_MOUTH_RATIO) {
    const distance =
      ratio < MIN_NOSE_TO_MOUTH_RATIO
        ? MIN_NOSE_TO_MOUTH_RATIO - ratio
        : ratio - MAX_NOSE_TO_MOUTH_RATIO;
    return clamp01(1 - distance / 0.25) * 0.35;
  }

  const deviation = Math.abs(ratio - IDEAL_NOSE_TO_MOUTH_RATIO);
  return clamp01(1 - deviation / 0.22);
}

/**
 * Composite KYC selfie confidence (0–1) from detector score + geometry heuristics.
 * Variable per image; use `KYC_SELFIE_MIN_COMPUTED_CONFIDENCE` as the pass threshold.
 */
export function computeSelfieFaceConfidenceBreakdown(
  detection: SelfieFaceDetectionInput,
  imageWidth: number,
  imageHeight: number,
): SelfieFaceConfidenceBreakdown {
  const detectionScore = clamp01(detection.score);
  const faceSize = scoreFaceSize(detection.box, imageWidth, imageHeight);
  const landmarkAlignment = scoreLandmarkAlignment(detection.landmarks);
  const featureSpacing = scoreFeatureSpacing(detection.landmarks);

  const weighted =
    WEIGHTS.detection * detectionScore +
    WEIGHTS.faceSize * faceSize +
    WEIGHTS.landmarkAlignment * landmarkAlignment +
    WEIGHTS.featureSpacing * featureSpacing;

  // Detector uncertainty caps overall confidence (occluded faces often score low here).
  const computed = clamp01(weighted * (0.45 + 0.55 * detectionScore));

  return {
    detection: detectionScore,
    faceSize,
    landmarkAlignment,
    featureSpacing,
    computed,
  };
}

export function pickBestFaceConfidence(
  detections: SelfieFaceDetectionInput[],
  imageWidth: number,
  imageHeight: number,
): SelfieFaceConfidenceBreakdown | null {
  if (!detections.length) return null;

  let best: SelfieFaceConfidenceBreakdown | null = null;
  for (const d of detections) {
    const breakdown = computeSelfieFaceConfidenceBreakdown(d, imageWidth, imageHeight);
    if (!best || breakdown.computed > best.computed) {
      best = breakdown;
    }
  }
  return best;
}
