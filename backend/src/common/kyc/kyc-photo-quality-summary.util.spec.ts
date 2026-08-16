import {
  summarizeIdentityReferencePhoto,
  summarizePhotoQuality,
  withIdentityMatch,
} from './kyc-photo-quality-summary.util';
import type { KycSelfieFaceInspection } from './kyc-selfie-face-validation.util';

function inspection(overrides: Partial<KycSelfieFaceInspection>): KycSelfieFaceInspection {
  return {
    ok: true,
    productionValidationDisabled: false,
    imageWidth: 720,
    imageHeight: 720,
    minConfidenceRequired: 0.5,
    minComputedConfidenceRequired: 0.55,
    bestComputedConfidence: 0.82,
    confidenceBreakdown: null,
    minFaceAreaRatio: 0.08,
    laplacianVariance: 40,
    minLaplacianVarianceRequired: 18,
    blurPassed: true,
    meanFaceLuminance: 90,
    darkPixelRatio: 0.1,
    luminanceStd: 20,
    highlightP90: 160,
    minMeanFaceLuminanceRequired: 28,
    maxDarkPixelRatioAllowed: 0.72,
    lightingPassed: true,
    eyesOpenPassed: true,
    eyeAspectRatio: 0.25,
    eyePupilDarkness: 20,
    faceNotMaskedPassed: true,
    lipSeamStrength: 15,
    aiModifiedPassed: true,
    rawDetectionCount: 1,
    qualifyingDetectionCount: 1,
    detections: [],
    ...overrides,
  };
}

describe('summarizeIdentityReferencePhoto', () => {
  it('treats government-photo quality as advisory and never applies liveness', () => {
    const quality = summarizeIdentityReferencePhoto(
      inspection({
        ok: false,
        reason: 'Aadhaar photo is too blurry.',
        blurPassed: false,
        bestComputedConfidence: 0.4,
      }),
    );
    expect(quality.qualityChecksApplied).toBe(false);
    expect(quality.ok).toBe(false);
    expect(quality.blurPassed).toBe(false);
    expect(quality.passiveLivenessPassed).toBeNull();
  });

  it('does not treat closed eyes on an ID photo as a quality failure', () => {
    const quality = summarizeIdentityReferencePhoto(
      inspection({
        ok: false,
        reason: 'Keep your eyes open and look at the camera.',
        eyesOpenPassed: false,
      }),
    );
    expect(quality.ok).toBe(true);
    expect(quality.eyesOpenPassed).toBeNull();
  });
});

describe('summarizePhotoQuality', () => {
  it('passes a clear live selfie and reports passive liveness', () => {
    const quality = summarizePhotoQuality(inspection({}), 'Selfie');
    expect(quality.qualityChecksApplied).toBe(true);
    expect(quality.ok).toBe(true);
    expect(quality.passiveLivenessPassed).toBe(true);
    expect(quality.identityMatchPassed).toBeNull();
  });

  it('fails closed eyes without treating the face as covered', () => {
    const quality = summarizePhotoQuality(
      inspection({
        ok: false,
        reason: 'Keep your eyes open and look at the camera.',
        eyesOpenPassed: false,
      }),
      'Selfie',
    );
    expect(quality.ok).toBe(false);
    expect(quality.eyesOpenPassed).toBe(false);
    expect(quality.faceNotCovered).toBe(true);
    expect(quality.passiveLivenessPassed).toBe(false);
  });

  it('records identity match after Aadhaar comparison', () => {
    const quality = withIdentityMatch(summarizePhotoQuality(inspection({}), 'Selfie'), true);
    expect(quality.identityMatchPassed).toBe(true);
  });
});
