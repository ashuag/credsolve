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
    const lighting =
      v.lightingPassed === false
        ? ' · too dark'
        : v.meanFaceLuminance != null
          ? ` · luminance ${formatLaplacianVariance(v.meanFaceLuminance)}`
          : '';
    return `Passed · computed ${formatConfidencePercent(v.bestComputedConfidence)}${blur}${lighting}`;
  }
  if (v.blurPassed === false && v.laplacianVariance != null) {
    return `Failed · blurry (${formatLaplacianVariance(v.laplacianVariance)} / min ${formatLaplacianVariance(v.minLaplacianVarianceRequired)})`;
  }
  if (v.lightingPassed === false) {
    const mean =
      v.meanFaceLuminance != null ? ` (${formatLaplacianVariance(v.meanFaceLuminance)} mean luminance)` : '';
    return `Failed · too dark${mean}`;
  }
  if (v.eyesOpenPassed === false) return 'Failed · eyes closed';
  if (v.faceNotMaskedPassed === false) return 'Failed · mask detected';
  if (v.aiModifiedPassed === false) return 'Failed · image looks digitally altered';
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

export function formatHeadMovementScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

const HEAD_MOVEMENT_DIRECTION_LABELS: Record<string, string> = {
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
  tilt: 'tilt',
};

/** Directions the head actually moved in, e.g. `left, right`. */
export function formatHeadMovementDirections(
  s: LosLivenessSummary | null | undefined,
): string | null {
  const explicit = s?.headMovementDirections
    ?.map((d) => HEAD_MOVEMENT_DIRECTION_LABELS[d] ?? d)
    .filter(Boolean);
  if (explicit?.length) return explicit.join(', ');

  const fallback: string[] = [];
  if (s?.headTurnLeftDetected === true) fallback.push('left');
  if (s?.headTurnRightDetected === true) fallback.push('right');
  if (s?.headTiltUpDetected === true) fallback.push('up');
  if (s?.headTiltDownDetected === true) fallback.push('down');
  return fallback.length ? fallback.join(', ') : null;
}

/** Active liveness only (head movement) — expression anti-spoof is step 3 in the pipeline. */
export function formatActiveLivenessOnlySummary(row: {
  livenessSummary: LosLivenessSummary | null;
}): string {
  const s = row.livenessSummary;
  if (!s) return 'Not run';
  // The head-movement recording is scored before the liveness pipeline runs, so a result
  // can exist while `checkedAt` is still null.
  if (!s.checkedAt && s.headMovementScore == null) return 'Not run';
  if (s.activeLivenessPassed == null && s.headMovementScore == null) {
    return 'Not recorded';
  }

  const activePassed = s.activeLivenessPassed ?? s.passed;
  const parts = [activePassed ? 'Passed' : 'Failed'];

  if (s.headMovementScore != null) {
    parts.push(`movement ${formatHeadMovementScore(s.headMovementScore)}`);
  }

  const signals: string[] = [];
  const directions = formatHeadMovementDirections(s);
  if (directions) signals.push(`head ${directions}`);
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
  aadhaarKycCompleted?: boolean;
  aadhaarIdentityFailure?: { message?: string } | null;
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
    return row.aadhaarIdentityFailure?.message?.trim() ||
      row.kycStatusLabel?.trim() ||
      'KYC verification failed — name or date of birth did not match Aadhaar.';
  }

  if (row.kycStatus === 3) {
    return row.kycStatusLabel?.trim() || 'KYC is incomplete due to a technical issue.';
  }

  const aadhaarComplete = Boolean(row.aadhaarKycCompleted || row.kycPhotos.aadhaarPhotoPath?.trim());
  if (!aadhaarComplete) {
    return 'KYC is not done because DigiLocker Aadhaar has not been captured yet.';
  }

  if (!row.livenessPassed) {
    return 'Aadhaar KYC is complete. Selfie / liveness KYC is still pending.';
  }

  return row.kycStatusLabel?.trim()
    ? `KYC is not done (${row.kycStatusLabel}).`
    : 'KYC is not done yet.';
}
