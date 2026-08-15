import type { KycSelfieFaceInspection } from './kyc-selfie-face-validation.util';

/**
 * Flattens a {@link KycSelfieFaceInspection} into the per-gate booleans shown to operators
 * (LOS developer tool) and to customers (KYC selfie step), so both read the same verdict
 * from the same inspection.
 */
export type PhotoQualityChecks = {
  /** Laplacian blur gate on the face crop. */
  blurPassed: boolean | null;
  /** Face crop not too dark (mean luminance + dark-pixel ratio, skin-tone aware). */
  lightingPassed: boolean | null;
  /** Single face large enough in frame (full face). */
  fullFaceDetected: boolean;
  /** Eyes / nose / mouth landmarks look unobstructed. */
  faceNotCovered: boolean;
  /**
   * True when 2+ qualifying faces were detected (dual / multi person).
   * Must be false for photo quality to pass.
   */
  dualFaceDetected: boolean;
  /** Qualifying face detections used for single-person / dual-face checks. */
  faceCount: number;
  /** Composite face-api confidence (0–1) when available. */
  qualityScore: number | null;
  /** All quality gates passed. */
  ok: boolean;
  reason?: string;
  inspection: KycSelfieFaceInspection;
};

/**
 * The individual gates are recovered from the inspection's human-readable `reason`, because
 * validation short-circuits on the first failure and does not report per-gate booleans.
 */
export function summarizePhotoQuality(
  inspection: KycSelfieFaceInspection,
  label: string,
): PhotoQualityChecks {
  const reason = inspection.reason?.trim() ?? '';
  const reasonLower = reason.toLowerCase();
  const qualityScore = inspection.bestComputedConfidence;
  const faceCount = inspection.qualifyingDetectionCount;
  const dualFaceDetected = faceCount > 1 || /only one person/i.test(reasonLower);

  const blurPassed = inspection.blurPassed;
  const lightingPassed = inspection.lightingPassed;
  const noFaceDetected = /could not detect|dimensions are invalid/i.test(reasonLower);
  const tooFarFromCamera = /move closer|fills more of the frame/i.test(reasonLower);
  const faceCovered = /do not cover your eyes|cover your eyes, nose, or mouth/i.test(reasonLower);
  const fullFaceDetected = !dualFaceDetected && faceCount === 1 && !noFaceDetected && !tooFarFromCamera;
  /** Covering is a landmark failure — a missing face is not treated as “covered”. */
  const faceNotCovered = !faceCovered;

  if (dualFaceDetected) {
    return {
      blurPassed,
      lightingPassed,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: true,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label}: only one person should appear in the photo.`,
      inspection,
    };
  }

  if (inspection.ok) {
    return {
      blurPassed: blurPassed ?? true,
      lightingPassed: lightingPassed ?? true,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: true,
      inspection,
    };
  }

  if (blurPassed === false) {
    return {
      blurPassed: false,
      lightingPassed,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label} is too blurry.`,
      inspection,
    };
  }

  if (lightingPassed === false) {
    return {
      blurPassed: blurPassed ?? true,
      lightingPassed: false,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label} is too dark.`,
      inspection,
    };
  }

  return {
    blurPassed,
    lightingPassed,
    fullFaceDetected,
    faceNotCovered,
    dualFaceDetected: false,
    faceCount,
    qualityScore,
    ok: false,
    reason: reason || `${label} quality check failed.`,
    inspection,
  };
}
