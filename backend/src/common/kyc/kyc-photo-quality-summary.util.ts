import type { KycSelfieFaceInspection } from './kyc-selfie-face-validation.util';

/**
 * Flattens a {@link KycSelfieFaceInspection} into the per-gate booleans shown to operators
 * (LOS developer tool) and to customers (KYC selfie step), so both read the same verdict
 * from the same inspection.
 *
 * Quality / liveness gates apply only to the live selfie. The Aadhaar (reference) photo is
 * inspected so operators can see that a government scan is blurry, but that fail is advisory
 * and never skips face match.
 */
export type PhotoQualityChecks = {
  /**
   * False for the Aadhaar / ID reference: quality is advisory and does not gate KYC.
   * True for the live selfie.
   */
  qualityChecksApplied: boolean;
  /** Laplacian blur gate on the face crop. */
  blurPassed: boolean | null;
  /** Face crop not too dark (mean luminance + dark-pixel ratio, skin-tone aware). */
  lightingPassed: boolean | null;
  /** Eyes look open (eye-aspect ratio). */
  eyesOpenPassed: boolean | null;
  /** Mouth landmarks are visible enough that a mask is unlikely. */
  faceNotMaskedPassed: boolean | null;
  /** Conservative still-image heuristic for over-smoothed / AI-edited faces. */
  aiModifiedPassed: boolean | null;
  /**
   * Passive still-image liveness: single full face, not covered/masked, eyes open.
   * Active head-movement liveness is a later step and is not included here.
   */
  passiveLivenessPassed: boolean | null;
  /** Aadhaar↔selfie descriptor match. Null until matching has run. */
  identityMatchPassed: boolean | null;
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
  /**
   * For the selfie: all quality gates passed.
   * For Aadhaar: advisory image quality (govt photos are often blurry). Never blocks face match.
   */
  ok: boolean;
  reason?: string;
  inspection: KycSelfieFaceInspection;
};

function passiveLivenessFromGates(params: {
  fullFaceDetected: boolean;
  dualFaceDetected: boolean;
  faceNotCovered: boolean;
  faceNotMaskedPassed: boolean | null;
  eyesOpenPassed: boolean | null;
}): boolean {
  return (
    params.fullFaceDetected &&
    !params.dualFaceDetected &&
    params.faceNotCovered &&
    params.faceNotMaskedPassed !== false &&
    params.eyesOpenPassed !== false
  );
}

function baseSelfieChecks(
  inspection: KycSelfieFaceInspection,
  overrides: Partial<PhotoQualityChecks> & Pick<PhotoQualityChecks, 'ok'>,
): PhotoQualityChecks {
  const dualFaceDetected = overrides.dualFaceDetected ?? false;
  const fullFaceDetected = overrides.fullFaceDetected ?? true;
  const faceNotCovered = overrides.faceNotCovered ?? true;
  const faceNotMaskedPassed = overrides.faceNotMaskedPassed ?? inspection.faceNotMaskedPassed;
  const eyesOpenPassed = overrides.eyesOpenPassed ?? inspection.eyesOpenPassed;
  return {
    qualityChecksApplied: true,
    blurPassed: overrides.blurPassed ?? inspection.blurPassed,
    lightingPassed: overrides.lightingPassed ?? inspection.lightingPassed,
    eyesOpenPassed,
    faceNotMaskedPassed,
    aiModifiedPassed: overrides.aiModifiedPassed ?? inspection.aiModifiedPassed,
    passiveLivenessPassed: passiveLivenessFromGates({
      fullFaceDetected,
      dualFaceDetected,
      faceNotCovered,
      faceNotMaskedPassed,
      eyesOpenPassed,
    }),
    identityMatchPassed: overrides.identityMatchPassed ?? null,
    fullFaceDetected,
    faceNotCovered,
    dualFaceDetected,
    faceCount: overrides.faceCount ?? inspection.qualifyingDetectionCount,
    qualityScore: overrides.qualityScore ?? inspection.bestComputedConfidence,
    ok: overrides.ok,
    reason: overrides.reason,
    inspection,
  };
}

/** Aadhaar / ID photo: quality is advisory (govt scans are often blurry) and never blocks face match. */
export function summarizeIdentityReferencePhoto(
  inspection: KycSelfieFaceInspection,
): PhotoQualityChecks {
  const quality = summarizePhotoQuality(inspection, 'Aadhaar photo');
  const livenessOnlyFail =
    !quality.ok &&
    quality.blurPassed !== false &&
    quality.lightingPassed !== false &&
    quality.fullFaceDetected &&
    !quality.dualFaceDetected;
  return {
    ...quality,
    qualityChecksApplied: false,
    ok: quality.ok || livenessOnlyFail,
    reason: livenessOnlyFail ? undefined : quality.reason,
    passiveLivenessPassed: null,
    eyesOpenPassed: null,
    faceNotMaskedPassed: null,
    aiModifiedPassed: null,
  };
}

export function withIdentityMatch(
  quality: PhotoQualityChecks,
  identityMatchPassed: boolean,
): PhotoQualityChecks {
  return { ...quality, identityMatchPassed };
}

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
  const eyesOpenPassed = inspection.eyesOpenPassed;
  const faceNotMaskedPassed = inspection.faceNotMaskedPassed;
  const aiModifiedPassed = inspection.aiModifiedPassed;
  const noFaceDetected = /could not detect|dimensions are invalid/i.test(reasonLower);
  const tooFarFromCamera = /move closer|fills more of the frame/i.test(reasonLower);
  const faceCovered = /do not cover your eyes|cover your eyes, nose, or mouth/i.test(reasonLower);
  const fullFaceDetected = !dualFaceDetected && faceCount === 1 && !noFaceDetected && !tooFarFromCamera;
  /** Covering is a landmark failure — a missing face is not treated as “covered”. */
  const faceNotCovered = !faceCovered;

  if (dualFaceDetected) {
    return baseSelfieChecks(inspection, {
      blurPassed,
      lightingPassed,
      eyesOpenPassed,
      faceNotMaskedPassed,
      aiModifiedPassed,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: true,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label}: only one person should appear in the photo.`,
    });
  }

  if (inspection.ok) {
    return baseSelfieChecks(inspection, {
      blurPassed: blurPassed ?? true,
      lightingPassed: lightingPassed ?? true,
      eyesOpenPassed: eyesOpenPassed ?? true,
      faceNotMaskedPassed: faceNotMaskedPassed ?? true,
      aiModifiedPassed: aiModifiedPassed ?? true,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: true,
    });
  }

  if (blurPassed === false) {
    return baseSelfieChecks(inspection, {
      blurPassed: false,
      lightingPassed,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label} is too blurry.`,
    });
  }

  if (lightingPassed === false) {
    return baseSelfieChecks(inspection, {
      blurPassed: blurPassed ?? true,
      lightingPassed: false,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label} is too dark.`,
    });
  }

  if (eyesOpenPassed === false) {
    return baseSelfieChecks(inspection, {
      blurPassed: blurPassed ?? true,
      lightingPassed: lightingPassed ?? true,
      eyesOpenPassed: false,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label}: keep your eyes open.`,
    });
  }

  if (faceNotMaskedPassed === false) {
    return baseSelfieChecks(inspection, {
      blurPassed: blurPassed ?? true,
      lightingPassed: lightingPassed ?? true,
      faceNotMaskedPassed: false,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label}: remove any mask covering your mouth.`,
    });
  }

  if (aiModifiedPassed === false) {
    return baseSelfieChecks(inspection, {
      blurPassed: blurPassed ?? true,
      lightingPassed: lightingPassed ?? true,
      aiModifiedPassed: false,
      fullFaceDetected: true,
      faceNotCovered: true,
      dualFaceDetected: false,
      faceCount,
      qualityScore,
      ok: false,
      reason: reason || `${label} looks digitally altered.`,
    });
  }

  return baseSelfieChecks(inspection, {
    blurPassed,
    lightingPassed,
    eyesOpenPassed,
    faceNotMaskedPassed,
    aiModifiedPassed,
    fullFaceDetected,
    faceNotCovered,
    dualFaceDetected: false,
    faceCount,
    qualityScore,
    ok: false,
    reason: reason || `${label} quality check failed.`,
  });
}
