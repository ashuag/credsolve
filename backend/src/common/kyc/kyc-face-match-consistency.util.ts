export type FaceAgeBand = 'child' | 'youth' | 'adult';
export type FaceMatchStrength = 'strong' | 'borderline' | 'fail';

export type FaceGeometryInput = {
  box: { x: number; y: number; width: number; height: number };
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  noseTip: { x: number; y: number };
  mouthCenter: { x: number; y: number };
};

export type FaceGeometryMetrics = {
  aspect: number;
  eyeLineRatio: number;
  interocularRatio: number;
  midfaceRatio: number;
  childLikeness: number;
  ageBand: FaceAgeBand;
};

export type FaceAgeEstimate = {
  age: number;
  gender: 'male' | 'female' | null;
  genderProbability: number | null;
};

export type KycFaceMatchDescriptorCheck = {
  passed: boolean;
  distance: number;
  maxDistance: number;
  strength: FaceMatchStrength;
};

export type KycFaceMatchGeometryCheck = {
  passed: boolean;
  applied: boolean;
  referenceChildLikeness: number | null;
  probeChildLikeness: number | null;
  referenceAgeBand: FaceAgeBand | null;
  probeAgeBand: FaceAgeBand | null;
  reason?: string;
};

export type KycFaceMatchAgeEstimateCheck = {
  passed: boolean;
  applied: boolean;
  referenceAge: number | null;
  probeAge: number | null;
  referenceAgeBand: FaceAgeBand | null;
  probeAgeBand: FaceAgeBand | null;
  reason?: string;
};

export type KycFaceMatchChecks = {
  descriptor: KycFaceMatchDescriptorCheck;
  geometry: KycFaceMatchGeometryCheck;
  ageEstimate: KycFaceMatchAgeEstimateCheck;
};

/** Probe (selfie) child-likeness at/above this is treated as a young child. */
export const KYC_FACE_MATCH_CHILD_LIKENESS_MIN = resolveEnvFloat(
  'KYC_FACE_MATCH_CHILD_LIKENESS_MIN',
  0.62,
);
/** Reference (Aadhaar) child-likeness at/below this is treated as teen/adult. */
export const KYC_FACE_MATCH_ADULT_LIKENESS_MAX = resolveEnvFloat(
  'KYC_FACE_MATCH_ADULT_LIKENESS_MAX',
  0.45,
);
/** Age-net: younger than this is a young child. */
export const KYC_FACE_MATCH_CHILD_AGE_MAX = resolveEnvFloat('KYC_FACE_MATCH_CHILD_AGE_MAX', 8);
/** Age-net: this age and up is teen/adult. */
export const KYC_FACE_MATCH_ADULT_AGE_MIN = resolveEnvFloat('KYC_FACE_MATCH_ADULT_AGE_MIN', 14);

export function isFaceMatchGeometryDisabled(): boolean {
  return envFlagTrue('KYC_FACE_MATCH_GEOMETRY_DISABLED');
}

export function isFaceMatchAgeEstimateDisabled(): boolean {
  return envFlagTrue('KYC_FACE_MATCH_AGE_ESTIMATE_DISABLED');
}

export function describeMatchStrength(
  distance: number,
  maxDistance: number,
): FaceMatchStrength {
  if (distance > maxDistance) return 'fail';
  if (distance > maxDistance - 0.06) return 'borderline';
  return 'strong';
}

export function ageBandFromEstimatedAge(
  age: number,
  childMax = KYC_FACE_MATCH_CHILD_AGE_MAX,
  adultMin = KYC_FACE_MATCH_ADULT_AGE_MIN,
): FaceAgeBand {
  if (age < childMax) return 'child';
  if (age < adultMin) return 'youth';
  return 'adult';
}

export function ageBandFromChildLikeness(
  childLikeness: number,
  childMin = KYC_FACE_MATCH_CHILD_LIKENESS_MIN,
  adultMax = KYC_FACE_MATCH_ADULT_LIKENESS_MAX,
): FaceAgeBand {
  if (childLikeness >= childMin) return 'child';
  if (childLikeness <= adultMax) return 'adult';
  return 'youth';
}

/**
 * Scale-free craniofacial ratios from 68-landmark eye / nose / mouth centers.
 * Toddlers are rounder, have a lower eye line, larger eyes vs face height, and a shorter midface.
 */
export function geometryInputFromLandmarks(params: {
  box: { x: number; y: number; width: number; height: number };
  leftEye: Array<{ x: number; y: number }>;
  rightEye: Array<{ x: number; y: number }>;
  nose: Array<{ x: number; y: number }>;
  mouth: Array<{ x: number; y: number }>;
}): FaceGeometryInput | null {
  const leftEye = centerPoint(params.leftEye);
  const rightEye = centerPoint(params.rightEye);
  const mouthCenter = centerPoint(params.mouth);
  const noseTip = params.nose[Math.min(3, Math.max(0, params.nose.length - 1))];
  if (!leftEye || !rightEye || !mouthCenter || !noseTip) return null;
  return {
    box: params.box,
    leftEye,
    rightEye,
    noseTip: { x: noseTip.x, y: noseTip.y },
    mouthCenter,
  };
}

export function computeFaceGeometry(input: FaceGeometryInput): FaceGeometryMetrics | null {
  const { box, leftEye, rightEye, mouthCenter } = input;
  if (!(box.width > 4) || !(box.height > 4)) return null;

  const interocular = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (!Number.isFinite(interocular) || interocular < 4) return null;

  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const aspect = box.width / box.height;
  const eyeLineRatio = (eyeMidY - box.y) / box.height;
  const interocularRatio = interocular / box.height;
  const midfaceRatio = (mouthCenter.y - eyeMidY) / box.height;
  if (![aspect, eyeLineRatio, interocularRatio, midfaceRatio].every(Number.isFinite)) return null;

  const childLikeness = mean([
    clamp01((aspect - 0.7) / 0.3),
    clamp01((eyeLineRatio - 0.36) / 0.18),
    clamp01((interocularRatio - 0.26) / 0.16),
    1 - clamp01((midfaceRatio - 0.2) / 0.18),
  ]);

  return {
    aspect,
    eyeLineRatio,
    interocularRatio,
    midfaceRatio,
    childLikeness,
    ageBand: ageBandFromChildLikeness(childLikeness),
  };
}

/**
 * Extra identity gates on top of descriptor distance.
 *
 * Only the fraud direction is rejected: selfie looks like a young child while the Aadhaar
 * photo does not. The reverse (childhood Aadhaar vs adult selfie) is allowed — those photos
 * are common and name/DOB already bind the identity.
 */
export function evaluateFaceMatchConsistency(params: {
  distance: number;
  maxDistance: number;
  referenceGeometry: FaceGeometryMetrics | null;
  probeGeometry: FaceGeometryMetrics | null;
  referenceAge: FaceAgeEstimate | null;
  probeAge: FaceAgeEstimate | null;
}): KycFaceMatchChecks {
  const descriptorPassed = params.distance <= params.maxDistance;
  const descriptor: KycFaceMatchDescriptorCheck = {
    passed: descriptorPassed,
    distance: params.distance,
    maxDistance: params.maxDistance,
    strength: describeMatchStrength(params.distance, params.maxDistance),
  };

  return {
    descriptor,
    geometry: evaluateGeometryCheck(params.referenceGeometry, params.probeGeometry),
    ageEstimate: evaluateAgeEstimateCheck(params.referenceAge, params.probeAge),
  };
}

export function extraFaceMatchChecksPassed(checks: KycFaceMatchChecks): boolean {
  return checks.descriptor.passed && checks.geometry.passed && checks.ageEstimate.passed;
}

export function operatorFaceMatchFailReason(checks: KycFaceMatchChecks): string | undefined {
  if (!checks.ageEstimate.passed && checks.ageEstimate.reason) return checks.ageEstimate.reason;
  if (!checks.geometry.passed && checks.geometry.reason) return checks.geometry.reason;
  if (!checks.descriptor.passed) {
    return 'The selfie does not match the Aadhaar photo. Retake a well-lit selfie with your full face visible.';
  }
  return undefined;
}

function evaluateGeometryCheck(
  reference: FaceGeometryMetrics | null,
  probe: FaceGeometryMetrics | null,
): KycFaceMatchGeometryCheck {
  const base: KycFaceMatchGeometryCheck = {
    passed: true,
    applied: false,
    referenceChildLikeness: reference?.childLikeness ?? null,
    probeChildLikeness: probe?.childLikeness ?? null,
    referenceAgeBand: reference?.ageBand ?? null,
    probeAgeBand: probe?.ageBand ?? null,
  };
  if (isFaceMatchGeometryDisabled() || !reference || !probe) return base;

  const applied: KycFaceMatchGeometryCheck = { ...base, applied: true };
  if (isChildVsNonChild(probe.ageBand, reference.ageBand)) {
    return {
      ...applied,
      passed: false,
      reason:
        'Selfie facial proportions look like a young child; the Aadhaar photo does not.',
    };
  }
  return applied;
}

function evaluateAgeEstimateCheck(
  reference: FaceAgeEstimate | null,
  probe: FaceAgeEstimate | null,
): KycFaceMatchAgeEstimateCheck {
  const referenceBand = reference ? ageBandFromEstimatedAge(reference.age) : null;
  const probeBand = probe ? ageBandFromEstimatedAge(probe.age) : null;
  const base: KycFaceMatchAgeEstimateCheck = {
    passed: true,
    applied: false,
    referenceAge: reference?.age ?? null,
    probeAge: probe?.age ?? null,
    referenceAgeBand: referenceBand,
    probeAgeBand: probeBand,
  };
  if (isFaceMatchAgeEstimateDisabled() || !reference || !probe) return base;

  const applied: KycFaceMatchAgeEstimateCheck = { ...base, applied: true };
  if (isChildVsNonChild(probeBand, referenceBand)) {
    return {
      ...applied,
      passed: false,
      reason: 'Estimated age on the selfie looks like a young child; the Aadhaar photo does not.',
    };
  }
  return applied;
}

function isChildVsNonChild(
  probeBand: FaceAgeBand | null,
  referenceBand: FaceAgeBand | null,
): boolean {
  return probeBand === 'child' && referenceBand != null && referenceBand !== 'child';
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function envFlagTrue(name: string): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function resolveEnvFloat(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function centerPoint(points: Array<{ x: number; y: number }>): { x: number; y: number } | null {
  if (!points.length) return null;
  const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
