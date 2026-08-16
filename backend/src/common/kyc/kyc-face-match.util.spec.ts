import {
  computeDetectionUpscaleSize,
  distanceToMatchScore,
  evaluateFaceMatch,
  resolveEffectiveMaxDistance,
} from './kyc-face-match.util';

describe('kyc-face-match.util', () => {
  it('maps zero distance to score 1', () => {
    expect(distanceToMatchScore(0)).toBe(1);
  });

  it('maps distance 0.6 to score 0.4', () => {
    expect(distanceToMatchScore(0.6)).toBeCloseTo(0.4);
  });

  it('passes when distance is at threshold', () => {
    const out = evaluateFaceMatch(0.6, 0.6);
    expect(out.matchPassed).toBe(true);
    expect(out.matchScore).toBeCloseTo(0.4);
  });

  it('fails when distance exceeds threshold', () => {
    const out = evaluateFaceMatch(0.61, 0.6);
    expect(out.matchPassed).toBe(false);
  });

  describe('computeDetectionUpscaleSize', () => {
    it('upscales a tiny DigiLocker-sized Aadhaar crop so the short side hits the target', () => {
      const out = computeDetectionUpscaleSize(200, 160, 400);
      expect(out).toEqual([500, 400]);
    });

    it('returns null when the short side already meets the target', () => {
      expect(computeDetectionUpscaleSize(400, 320, 400)).toBeNull();
      expect(computeDetectionUpscaleSize(720, 720, 400)).toBeNull();
    });

    it('returns null for a zero-sized image instead of dividing by zero', () => {
      expect(computeDetectionUpscaleSize(0, 0, 400)).toBeNull();
    });

    it('preserves aspect ratio when scaling up', () => {
      const out = computeDetectionUpscaleSize(300, 100, 400);
      expect(out).toEqual([1200, 400]);
    });
  });

  describe('resolveEffectiveMaxDistance', () => {
    it('keeps the base threshold when the reference photo was detected with high confidence', () => {
      expect(resolveEffectiveMaxDistance(0.998, 0.6, 0.85, 0.05)).toBe(0.6);
      expect(resolveEffectiveMaxDistance(0.85, 0.6, 0.85, 0.05)).toBe(0.6);
    });

    it('relaxes the threshold when the reference photo was detected with low confidence', () => {
      expect(resolveEffectiveMaxDistance(0.33, 0.6, 0.85, 0.05)).toBeCloseTo(0.65);
    });

    it('keeps the base threshold when the reference detection score is unknown', () => {
      expect(resolveEffectiveMaxDistance(null, 0.6, 0.85, 0.05)).toBe(0.6);
    });
  });
});
