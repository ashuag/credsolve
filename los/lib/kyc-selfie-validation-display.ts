import type { LosLivenessSummary, LosMoneyCashFaceMatch, LosSelfieFaceValidation } from '@/lib/api';

export function formatConfidencePercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatLaplacianVariance(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(1);
}

export function formatDistance(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(3);
}

export function formatSelfieFaceValidationSummary(row: {
  selfieFaceValidation: LosSelfieFaceValidation | null;
}): string {
  const v = row.selfieFaceValidation;
  if (!v?.checkedAt) return 'Not checked';
  if (v.passed) {
    const blur =
      v.blurPassed === false
        ? ' · blur failed'
        : v.laplacianVariance != null
          ? ` · sharpness ${formatLaplacianVariance(v.laplacianVariance)}`
          : '';
    return `Passed · computed ${formatConfidencePercent(v.bestComputedConfidence)}${blur}`;
  }
  if (v.blurPassed === false && v.laplacianVariance != null) {
    return `Failed · blurry (${formatLaplacianVariance(v.laplacianVariance)} / min ${formatLaplacianVariance(v.minLaplacianVarianceRequired)})`;
  }
  return `Failed · computed ${formatConfidencePercent(v.bestComputedConfidence)}`;
}

function isFaceMatchPending(m: LosMoneyCashFaceMatch | null): boolean {
  return (m?.reason?.trim() ?? '').startsWith('Pending');
}

function isFaceMatchSkipped(m: LosMoneyCashFaceMatch | null): boolean {
  return (m?.reason?.trim() ?? '').startsWith('Skipped');
}

export function formatMoneyCashFaceMatchSummary(row: {
  moneyCashFaceMatch: LosMoneyCashFaceMatch | null;
}): string {
  const m = row.moneyCashFaceMatch;
  if (!m) return 'Not run';
  if (isFaceMatchPending(m)) {
    return 'Pending · runs after selfie quality passes';
  }
  if (isFaceMatchSkipped(m)) {
    const detail = m.reason?.replace(/^Skipped —?\s*/i, '').trim();
    return detail ? `Skipped · ${detail}` : 'Skipped';
  }
  if (m.passed) {
    return m.matchScore != null
      ? `Passed · score ${formatConfidencePercent(m.matchScore)}`
      : 'Passed';
  }
  if (m.matchScore != null) {
    return `Failed · score ${formatConfidencePercent(m.matchScore)} · distance ${formatDistance(m.distance)} (max ${formatDistance(m.maxDistanceThreshold)})`;
  }
  if (m.reason?.trim()) return `Failed · ${m.reason}`;
  return m.checkedAt ? 'Failed' : 'Not run';
}

/** Active liveness only (head turns + smile) — expression anti-spoof is step 3 in the pipeline. */
export function formatActiveLivenessOnlySummary(row: {
  livenessSummary: LosLivenessSummary | null;
}): string {
  const s = row.livenessSummary;
  if (!s?.checkedAt) return 'Not run';

  const activePassed = s.activeLivenessPassed ?? s.passed;
  const parts = [activePassed ? 'Passed' : 'Failed'];

  if (s.mode === 'smooth') parts.push('smooth session');
  else if (s.mode === 'challenge') parts.push('challenge mode');

  const signals: string[] = [];
  if (s.headTurnLeftDetected === true || s.headTurnRightDetected === true) {
    signals.push('head turn');
  }
  if (s.blinkDetected === true) signals.push('blink');
  if (s.smileDetected === true) signals.push('smile');
  if (signals.length) parts.push(signals.join(', '));

  return parts.join(' · ');
}

export function formatActiveLivenessSummary(row: { livenessSummary: LosLivenessSummary | null }): string {
  return formatActiveLivenessOnlySummary(row);
}

/** @deprecated Use `formatActiveLivenessSummary`. */
export function formatLivenessSummary(row: { livenessSummary: LosLivenessSummary | null }): string {
  return formatActiveLivenessSummary(row);
}

export function formatExpressionAntiSpoofSummary(row: {
  livenessSummary: LosLivenessSummary | null;
}): string {
  const s = row.livenessSummary;
  if (!s?.checkedAt) return 'Not run';
  if (s.expressionAntiSpoofPassed === true) return 'Passed · natural expressions';
  if (s.expressionAntiSpoofPassed === false) {
    return s.expressionAntiSpoofReason?.trim()
      ? `Failed · ${s.expressionAntiSpoofReason}`
      : 'Failed · static or unnatural expressions';
  }
  return '—';
}

type KycIncompleteInput = {
  kycStatus: number;
  kycStatusLabel: string;
  livenessPassed: boolean;
  livenessCheckedAt: string | null;
  selfieFaceValidation: LosSelfieFaceValidation | null;
  moneyCashFaceMatch: LosMoneyCashFaceMatch | null;
  livenessSummary: LosLivenessSummary | null;
  kycPhotos: {
    selfiePath: string | null;
    aadhaarPhotoPath: string | null;
  };
};

/**
 * Human-readable reason KYC is still incomplete (or failed). Returns null when KYC is completed.
 */
export function explainKycNotDone(row: KycIncompleteInput): string | null {
  if (row.kycStatus === 1) return null;

  if (row.kycStatus === 2) {
    return row.kycStatusLabel?.trim() ||
      'KYC verification failed — name or date of birth did not match Aadhaar.';
  }

  if (row.kycStatus === 3) {
    return row.kycStatusLabel?.trim() || 'KYC is incomplete due to a technical issue.';
  }

  const hasSelfie = Boolean(row.kycPhotos.selfiePath?.trim());
  const hasAadhaarPhoto = Boolean(row.kycPhotos.aadhaarPhotoPath?.trim());
  const face = row.selfieFaceValidation;
  const faceMatch = row.moneyCashFaceMatch;
  const liveness = row.livenessSummary;
  const livenessChecked = Boolean(row.livenessCheckedAt || liveness?.checkedAt);
  const faceMatchRan = Boolean(
    faceMatch?.matchScore != null ||
      (faceMatch?.checkedAt &&
        faceMatch?.reason &&
        !isFaceMatchPending(faceMatch) &&
        !isFaceMatchSkipped(faceMatch)),
  );

  if (!hasSelfie) {
    return 'KYC is not done because the customer has not captured a selfie yet.';
  }

  if (face?.checkedAt && face.passed === false) {
    const detail = face.reason?.trim();
    return detail
      ? `KYC is not done because selfie quality check failed: ${detail}`
      : 'KYC is not done because the selfie did not pass quality checks.';
  }

  if (faceMatchRan && faceMatch?.passed === false) {
    const detail = faceMatch.reason?.trim();
    return detail
      ? `KYC is not done because Aadhaar face match failed: ${detail}`
      : 'KYC is not done because the selfie does not match the Aadhaar photo.';
  }

  if (!hasAadhaarPhoto && faceMatchRan) {
    return 'KYC is not done because the Aadhaar reference photo is missing.';
  }

  if (!livenessChecked) {
    return face?.passed
      ? 'KYC is not done because the customer has not completed the live face verification yet.'
      : 'KYC is not done because live face verification has not been completed yet.';
  }

  if (liveness?.expressionAntiSpoofPassed === false) {
    const expr = liveness.expressionAntiSpoofReason?.trim();
    return expr
      ? `KYC is not done because expression anti-spoof failed: ${expr}`
      : 'KYC is not done because facial expressions looked static or unnatural.';
  }

  const activePassed = liveness?.activeLivenessPassed ?? row.livenessPassed;
  if (!activePassed) {
    const detail = liveness?.activeLivenessReason?.trim();
    if (detail) return `KYC is not done because active liveness failed: ${detail}`;
    return 'KYC is not done because active liveness (head turn + smile) did not pass.';
  }

  if (!hasAadhaarPhoto) {
    return 'KYC is not done because the Aadhaar reference photo is missing.';
  }

  if (!row.livenessPassed) {
    return 'KYC is not done because the full liveness pipeline has not passed yet.';
  }

  return row.kycStatusLabel?.trim()
    ? `KYC is not done (${row.kycStatusLabel}).`
    : 'KYC is not done yet.';
}
