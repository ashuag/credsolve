import {
  computeSelfieFaceConfidenceBreakdown,
  pickBestFaceConfidence,
} from './kyc-selfie-face-confidence.util';
import {
  type SelfieFaceDetectionInput,
  validateKycSelfieFaceDetections,
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

describe('kyc-selfie-face-confidence', () => {
  it('returns higher computed confidence for a clear face than a low-score detection', () => {
    const clear = computeSelfieFaceConfidenceBreakdown(sampleFace(), 720, 720);
    const weak = computeSelfieFaceConfidenceBreakdown(sampleFace({ score: 0.42 }), 720, 720);
    expect(clear.computed).toBeGreaterThan(weak.computed);
    expect(clear.computed).toBeGreaterThan(0.55);
    expect(weak.computed).toBeLessThan(0.55);
  });

  it('picks the best detection by computed score', () => {
    const detections = [
      sampleFace({ score: 0.42 }),
      sampleFace({ score: 0.95 }),
    ];
    const best = pickBestFaceConfidence(detections, 720, 720);
    expect(best?.detection).toBeGreaterThan(0.9);
  });

  it('uses computed confidence in validation when enriched', () => {
    const face = sampleFace({ score: 0.42 });
    const enriched = {
      ...face,
      confidence: computeSelfieFaceConfidenceBreakdown(face, 720, 720),
    };
    const result = validateKycSelfieFaceDetections({
      detections: [enriched],
      imageWidth: 720,
      imageHeight: 720,
    });
    expect(result.ok).toBe(false);
  });
});
