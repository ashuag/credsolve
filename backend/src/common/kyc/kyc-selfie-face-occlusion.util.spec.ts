import {
  combineFaceChecks,
  evaluateSelfieAiModified,
  evaluateSelfieEyesOpen,
  evaluateSelfieMouthVisible,
} from './kyc-selfie-face-occlusion.util';

function eyeOpen(): Array<{ x: number; y: number }> {
  return [
    { x: 0, y: 10 },
    { x: 4, y: 6 },
    { x: 8, y: 6 },
    { x: 12, y: 10 },
    { x: 8, y: 14 },
    { x: 4, y: 14 },
  ];
}

function eyeClosed(): Array<{ x: number; y: number }> {
  return [
    { x: 0, y: 10 },
    { x: 4, y: 9.5 },
    { x: 8, y: 9.5 },
    { x: 12, y: 10 },
    { x: 8, y: 10.5 },
    { x: 4, y: 10.5 },
  ];
}

describe('evaluateSelfieEyesOpen', () => {
  it('passes when both eyes have a typical open aspect ratio', () => {
    const result = evaluateSelfieEyesOpen({
      leftEyeContour: eyeOpen(),
      rightEyeContour: eyeOpen(),
    });
    expect(result.eyesOpenPassed).toBe(true);
    expect(result.eyeAspectRatio).toBeGreaterThan(0.18);
  });

  it('fails when both eyes look shut', () => {
    const result = evaluateSelfieEyesOpen({
      leftEyeContour: eyeClosed(),
      rightEyeContour: eyeClosed(),
    });
    expect(result.eyesOpenPassed).toBe(false);
  });
});

describe('evaluateSelfieMouthVisible', () => {
  it('fails when the mouth contour is vertically crushed relative to the eyes', () => {
    const result = evaluateSelfieMouthVisible({
      leftEye: { x: 0, y: 0 },
      rightEye: { x: 100, y: 0 },
      mouthContour: [
        { x: 40, y: 80 },
        { x: 50, y: 80.5 },
        { x: 60, y: 80 },
        { x: 50, y: 81 },
      ],
    });
    expect(result.faceNotMaskedPassed).toBe(false);
  });

  it('passes when the mouth has a normal vertical span', () => {
    const result = evaluateSelfieMouthVisible({
      leftEye: { x: 0, y: 0 },
      rightEye: { x: 100, y: 0 },
      mouthContour: [
        { x: 40, y: 70 },
        { x: 60, y: 70 },
        { x: 60, y: 95 },
        { x: 40, y: 95 },
      ],
    });
    expect(result.faceNotMaskedPassed).toBe(true);
  });
});

describe('combineFaceChecks', () => {
  it('fails if either signal fails, even when the other passed or has no opinion', () => {
    expect(combineFaceChecks(false, true)).toBe(false);
    expect(combineFaceChecks(true, false)).toBe(false);
    expect(combineFaceChecks(false, null)).toBe(false);
  });

  it('passes only when neither signal failed and at least one has an opinion', () => {
    expect(combineFaceChecks(true, true)).toBe(true);
    expect(combineFaceChecks(true, null)).toBe(true);
    expect(combineFaceChecks(null, true)).toBe(true);
  });

  it('stays undecided when neither signal has an opinion', () => {
    expect(combineFaceChecks(null, null)).toBeNull();
  });
});

describe('evaluateSelfieAiModified', () => {
  it('flags an unnaturally flat, well-lit, non-blurry face crop', () => {
    expect(
      evaluateSelfieAiModified({
        luminanceStd: 3,
        meanFaceLuminance: 80,
        blurPassed: true,
      }).aiModifiedPassed,
    ).toBe(false);
  });

  it('does not flag a normally textured face', () => {
    expect(
      evaluateSelfieAiModified({
        luminanceStd: 18,
        meanFaceLuminance: 80,
        blurPassed: true,
      }).aiModifiedPassed,
    ).toBe(true);
  });
});
