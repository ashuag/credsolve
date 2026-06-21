import { distanceToMatchScore, evaluateFaceMatch } from './kyc-face-match.util';

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
});
