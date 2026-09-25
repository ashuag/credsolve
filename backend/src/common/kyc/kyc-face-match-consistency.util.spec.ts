import {
  ageBandFromChildLikeness,
  ageBandFromEstimatedAge,
  computeFaceGeometry,
  describeMatchStrength,
  evaluateFaceMatchConsistency,
  extraFaceMatchChecksPassed,
  type FaceGeometryInput,
} from './kyc-face-match-consistency.util';

function adultFace(): FaceGeometryInput {
  return {
    box: { x: 0, y: 0, width: 100, height: 130 },
    leftEye: { x: 32, y: 48 },
    rightEye: { x: 68, y: 48 },
    noseTip: { x: 50, y: 74 },
    mouthCenter: { x: 50, y: 96 },
  };
}

function toddlerFace(): FaceGeometryInput {
  return {
    box: { x: 0, y: 0, width: 100, height: 100 },
    leftEye: { x: 30, y: 50 },
    rightEye: { x: 70, y: 50 },
    noseTip: { x: 50, y: 62 },
    mouthCenter: { x: 50, y: 72 },
  };
}

describe('kyc-face-match-consistency.util', () => {
  it('labels descriptor strength around the cutoff', () => {
    expect(describeMatchStrength(0.4, 0.52)).toBe('strong');
    expect(describeMatchStrength(0.5, 0.52)).toBe('borderline');
    expect(describeMatchStrength(0.54, 0.52)).toBe('fail');
  });

  it('maps estimated ages into child / youth / adult', () => {
    expect(ageBandFromEstimatedAge(3)).toBe('child');
    expect(ageBandFromEstimatedAge(11)).toBe('youth');
    expect(ageBandFromEstimatedAge(16)).toBe('adult');
  });

  it('scores a typical adult face as adult and a toddler as a child', () => {
    const adult = computeFaceGeometry(adultFace());
    const toddler = computeFaceGeometry(toddlerFace());
    expect(adult).not.toBeNull();
    expect(toddler).not.toBeNull();
    expect(adult!.childLikeness).toBeLessThan(0.45);
    expect(toddler!.childLikeness).toBeGreaterThan(0.62);
    expect(ageBandFromChildLikeness(adult!.childLikeness)).toBe('adult');
    expect(ageBandFromChildLikeness(toddler!.childLikeness)).toBe('child');
  });

  it('fails teen Aadhaar + toddler selfie on geometry even when distance would pass', () => {
    const checks = evaluateFaceMatchConsistency({
      distance: 0.5,
      maxDistance: 0.52,
      referenceGeometry: computeFaceGeometry(adultFace()),
      probeGeometry: computeFaceGeometry(toddlerFace()),
      referenceAge: null,
      probeAge: null,
    });
    expect(checks.descriptor.passed).toBe(true);
    expect(checks.geometry.applied).toBe(true);
    expect(checks.geometry.passed).toBe(false);
    expect(extraFaceMatchChecksPassed(checks)).toBe(false);
  });

  it('allows a childhood Aadhaar photo against an adult selfie', () => {
    const checks = evaluateFaceMatchConsistency({
      distance: 0.48,
      maxDistance: 0.52,
      referenceGeometry: computeFaceGeometry(toddlerFace()),
      probeGeometry: computeFaceGeometry(adultFace()),
      referenceAge: { age: 5, gender: null, genderProbability: null },
      probeAge: { age: 21, gender: null, genderProbability: null },
    });
    expect(checks.geometry.passed).toBe(true);
    expect(checks.ageEstimate.passed).toBe(true);
    expect(extraFaceMatchChecksPassed(checks)).toBe(true);
  });

  it('fails when the age net says the selfie is a child and the ID is not', () => {
    const adult = computeFaceGeometry(adultFace());
    const checks = evaluateFaceMatchConsistency({
      distance: 0.5,
      maxDistance: 0.52,
      referenceGeometry: adult,
      probeGeometry: adult,
      referenceAge: { age: 16, gender: 'female', genderProbability: 0.9 },
      probeAge: { age: 3, gender: null, genderProbability: null },
    });
    expect(checks.geometry.passed).toBe(true);
    expect(checks.ageEstimate.applied).toBe(true);
    expect(checks.ageEstimate.passed).toBe(false);
    expect(extraFaceMatchChecksPassed(checks)).toBe(false);
  });

  it('does not reject two adult faces (glasses / hair change)', () => {
    const checks = evaluateFaceMatchConsistency({
      distance: 0.54,
      maxDistance: 0.6,
      referenceGeometry: computeFaceGeometry(adultFace()),
      probeGeometry: computeFaceGeometry({
        ...adultFace(),
        leftEye: { x: 33, y: 49 },
        rightEye: { x: 67, y: 49 },
      }),
      referenceAge: { age: 16, gender: 'female', genderProbability: 0.8 },
      probeAge: { age: 22, gender: 'female', genderProbability: 0.7 },
    });
    expect(checks.descriptor.passed).toBe(true);
    expect(checks.geometry.passed).toBe(true);
    expect(checks.ageEstimate.passed).toBe(true);
    expect(extraFaceMatchChecksPassed(checks)).toBe(true);
  });

  it('skips extra gates when landmarks or ages are missing', () => {
    const checks = evaluateFaceMatchConsistency({
      distance: 0.4,
      maxDistance: 0.52,
      referenceGeometry: null,
      probeGeometry: null,
      referenceAge: null,
      probeAge: null,
    });
    expect(checks.geometry.applied).toBe(false);
    expect(checks.ageEstimate.applied).toBe(false);
    expect(extraFaceMatchChecksPassed(checks)).toBe(true);
  });
});
