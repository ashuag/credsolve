import type { SelfieFaceConfidenceBreakdown } from './kyc-selfie-face-confidence.util';
import {
  computeSelfieFaceConfidenceBreakdown,
  pickBestFaceConfidence,
} from './kyc-selfie-face-confidence.util';

export type SelfieFaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelfieFaceLandmarkPoint = {
  x: number;
  y: number;
};

export type SelfieFaceDetectionInput = {
  score: number;
  box: SelfieFaceBox;
  landmarks: {
    leftEye: SelfieFaceLandmarkPoint;
    rightEye: SelfieFaceLandmarkPoint;
    noseTip: SelfieFaceLandmarkPoint;
    mouthCenter: SelfieFaceLandmarkPoint;
  };
  /** Composite confidence from detection + geometry. */
  confidence?: SelfieFaceConfidenceBreakdown;
};

export type SelfieFaceValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type KycSelfieFaceInspection = {
  ok: boolean;
  reason?: string;
  productionValidationDisabled: boolean;
  imageWidth: number;
  imageHeight: number;
  minConfidenceRequired: number;
  minComputedConfidenceRequired: number;
  bestComputedConfidence: number | null;
  confidenceBreakdown: SelfieFaceConfidenceBreakdown | null;
  minFaceAreaRatio: number;
  laplacianVariance: number | null;
  minLaplacianVarianceRequired: number;
  blurPassed: boolean | null;
  meanFaceLuminance: number | null;
  darkPixelRatio: number | null;
  /** Face-crop luminance std-dev (skin-tone-aware lighting detail). */
  luminanceStd: number | null;
  /** 90th-percentile luminance — highlights still present on deep skin tones. */
  highlightP90: number | null;
  minMeanFaceLuminanceRequired: number;
  maxDarkPixelRatioAllowed: number;
  lightingPassed: boolean | null;
  rawDetectionCount: number;
  qualifyingDetectionCount: number;
  detections: SelfieFaceDetectionInput[];
};

/** Minimum SSD Mobilenet face-detection confidence for KYC selfies. */
export const KYC_SELFIE_MIN_FACE_CONFIDENCE = 0.5;

/** Minimum composite confidence from {@link computeSelfieFaceConfidenceBreakdown}. */
export const KYC_SELFIE_MIN_COMPUTED_CONFIDENCE = 0.55;

/** Face bounding box must cover at least this fraction of the image area. */
export const KYC_SELFIE_MIN_FACE_AREA_RATIO = 0.08;

export function filterQualifyingSelfieFaceDetections(
  detections: SelfieFaceDetectionInput[],
  minConfidence: number = KYC_SELFIE_MIN_FACE_CONFIDENCE,
): SelfieFaceDetectionInput[] {
  return detections.filter((d) => {
    const detectionOk = d.score >= minConfidence;
    const computedOk =
      d.confidence?.computed == null || d.confidence.computed >= KYC_SELFIE_MIN_COMPUTED_CONFIDENCE;
    return detectionOk && computedOk;
  });
}

const MAX_EYE_LEVEL_DELTA_RATIO = 0.3;
const MIN_NOSE_TO_MOUTH_RATIO = 0.12;
const MAX_NOSE_TO_MOUTH_RATIO = 0.75;

export function validateKycSelfieFaceDetections(params: {
  detections: SelfieFaceDetectionInput[];
  imageWidth: number;
  imageHeight: number;
  minConfidence?: number;
  minFaceAreaRatio?: number;
}): SelfieFaceValidationResult {
  const minConfidence = params.minConfidence ?? KYC_SELFIE_MIN_FACE_CONFIDENCE;
  const minFaceAreaRatio = params.minFaceAreaRatio ?? KYC_SELFIE_MIN_FACE_AREA_RATIO;
  const imageArea = params.imageWidth * params.imageHeight;
  if (!Number.isFinite(imageArea) || imageArea <= 0) {
    return { ok: false, reason: 'Selfie image dimensions are invalid.' };
  }

  const qualifying = filterQualifyingSelfieFaceDetections(params.detections, minConfidence);
  if (qualifying.length === 0) {
    const best = pickBestFaceConfidence(params.detections, params.imageWidth, params.imageHeight);
    if (best && best.computed < KYC_SELFIE_MIN_COMPUTED_CONFIDENCE && best.detection >= minConfidence) {
      return {
        ok: false,
        reason:
          'Your full face must be visible — do not cover your eyes, nose, or mouth.',
      };
    }
    return {
      ok: false,
      reason:
        'We could not detect a clear, unobstructed face. Remove anything covering your face, use good lighting, and try again.',
    };
  }
  if (qualifying.length > 1) {
    return {
      ok: false,
      reason: 'Only one person should appear in the selfie.',
    };
  }

  const face = qualifying[0]!;
  const boxArea = face.box.width * face.box.height;
  if (boxArea / imageArea < minFaceAreaRatio) {
    return {
      ok: false,
      reason: 'Move closer so your full face fills more of the frame.',
    };
  }

  return validateKycSelfieFaceLandmarks(face.landmarks);
}

function validateKycSelfieFaceLandmarks(
  landmarks: SelfieFaceDetectionInput['landmarks'],
): SelfieFaceValidationResult {
  const { leftEye, rightEye, noseTip, mouthCenter } = landmarks;
  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  if (!Number.isFinite(eyeDist) || eyeDist < 8) {
    return {
      ok: false,
      reason:
        'Your full face must be visible — do not cover your eyes, nose, or mouth.',
    };
  }

  const eyeY = (leftEye.y + rightEye.y) / 2;
  if (!(eyeY < noseTip.y && noseTip.y < mouthCenter.y)) {
    return {
      ok: false,
      reason:
        'Your full face must be visible — do not cover your eyes, nose, or mouth.',
    };
  }

  if (Math.abs(leftEye.y - rightEye.y) > eyeDist * MAX_EYE_LEVEL_DELTA_RATIO) {
    return {
      ok: false,
      reason:
        'Your full face must be visible — do not cover your eyes, nose, or mouth.',
    };
  }

  const noseToMouth = Math.hypot(noseTip.x - mouthCenter.x, noseTip.y - mouthCenter.y);
  const noseToMouthRatio = noseToMouth / eyeDist;
  if (
    noseToMouthRatio < MIN_NOSE_TO_MOUTH_RATIO ||
    noseToMouthRatio > MAX_NOSE_TO_MOUTH_RATIO
  ) {
    return {
      ok: false,
      reason:
        'Your full face must be visible — do not cover your eyes, nose, or mouth.',
    };
  }

  return { ok: true };
}

/** Attach composite confidence to each detection. */
export function enrichSelfieFaceDetectionsWithConfidence(
  detections: SelfieFaceDetectionInput[],
  imageWidth: number,
  imageHeight: number,
): SelfieFaceDetectionInput[] {
  return detections.map((d) => ({
    ...d,
    confidence: computeSelfieFaceConfidenceBreakdown(d, imageWidth, imageHeight),
  }));
}
