import {
  validateKycSelfieFaceDetections,
  type SelfieFaceDetectionInput,
} from './kyc-selfie-face-validation.util';

function sampleFace(overrides?: Partial<SelfieFaceDetectionInput>): SelfieFaceDetectionInput {
  return {
    score: 0.92,
    box: { x: 180, y: 120, width: 360, height: 420 },
    landmarks: {
      leftEye: { x: 280, y: 280 },
      rightEye: { x: 420, y: 280 },
      noseTip: { x: 350, y: 360 },
      mouthCenter: { x: 350, y: 420 },
    },
    ...overrides,
  };
}

describe('validateKycSelfieFaceDetections', () => {
  it('accepts a single clear face with valid landmark geometry', () => {
    const result = validateKycSelfieFaceDetections({
      detections: [sampleFace()],
      imageWidth: 720,
      imageHeight: 720,
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects when no face meets the confidence threshold', () => {
    const result = validateKycSelfieFaceDetections({
      detections: [sampleFace({ score: 0.24 })],
      imageWidth: 720,
      imageHeight: 720,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/unobstructed face/i);
    }
  });

  it('rejects multiple qualifying faces of comparable size', () => {
    const result = validateKycSelfieFaceDetections({
      detections: [sampleFace(), sampleFace({ box: { x: 40, y: 40, width: 200, height: 240 } })],
      imageWidth: 720,
      imageHeight: 720,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/only one person/i);
    }
  });

  it('ignores a small background face (e.g. a framed photo on the wall)', () => {
    // Primary face fills 360x420 of a 720x720 frame; the second detection is ~1/16th its area,
    // representative of a framed photo or poster visible behind the subject.
    const result = validateKycSelfieFaceDetections({
      detections: [
        sampleFace(),
        sampleFace({
          score: 0.6,
          box: { x: 550, y: 40, width: 60, height: 70 },
          landmarks: {
            leftEye: { x: 565, y: 65 },
            rightEye: { x: 595, y: 65 },
            noseTip: { x: 580, y: 85 },
            mouthCenter: { x: 580, y: 100 },
          },
        }),
      ],
      imageWidth: 720,
      imageHeight: 720,
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects when mouth landmarks sit above the nose', () => {
    const result = validateKycSelfieFaceDetections({
      detections: [
        sampleFace({
          landmarks: {
            leftEye: { x: 280, y: 280 },
            rightEye: { x: 420, y: 280 },
            noseTip: { x: 350, y: 420 },
            mouthCenter: { x: 350, y: 360 },
          },
        }),
      ],
      imageWidth: 720,
      imageHeight: 720,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/full face must be visible/i);
    }
  });
});
