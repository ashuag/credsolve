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

export function formatMoneyCashFaceMatchSummary(row: {
  moneyCashFaceMatch: LosMoneyCashFaceMatch | null;
}): string {
  const m = row.moneyCashFaceMatch;
  if (!m) return 'Not run';
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

export function formatLivenessSummary(row: { livenessSummary: LosLivenessSummary | null }): string {
  const s = row.livenessSummary;
  if (!s?.checkedAt) return 'Not run';
  const parts = [s.passed ? 'Passed' : 'Failed'];
  if (s.vendorStatus === 'local-only') {
    parts.push('Tenacio skipped');
  } else if (s.vendorScore != null) {
    parts.push(`score ${formatConfidencePercent(s.vendorScore)}`);
  }
  if (s.isLive === true) parts.push('live');
  else if (s.isLive === false) parts.push('not live');
  return parts.join(' · ');
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
  const faceMatchRan = Boolean(faceMatch?.checkedAt || faceMatch?.reason || faceMatch?.matchScore != null);

  if (!hasSelfie) {
    return 'KYC is not done because the customer has not captured a selfie yet.';
  }

  if (face?.checkedAt && face.passed === false) {
    const detail = face.reason?.trim();
    return detail
      ? `KYC is not done because MoneyCash face validation failed: ${detail}`
      : 'KYC is not done because MoneyCash face validation did not pass.';
  }

  if (faceMatchRan && faceMatch?.passed === false) {
    const detail = faceMatch.reason?.trim();
    return detail
      ? `KYC is not done because MoneyCash face match failed: ${detail}`
      : 'KYC is not done because MoneyCash face match (Aadhaar vs selfie) did not pass.';
  }

  if (!hasAadhaarPhoto) {
    return 'KYC is not done because the Aadhaar reference photo is missing.';
  }

  if (!row.livenessPassed) {
    if (!livenessChecked) {
      return face?.passed && faceMatch?.passed
        ? 'KYC is not done because the Tenacio liveness check has not been completed yet. MoneyCash face validation and face match passed.'
        : face?.passed
          ? 'KYC is not done because the Tenacio liveness check has not been completed yet. MoneyCash face validation passed.'
          : 'KYC is not done because the Tenacio liveness check has not been completed yet.';
    }
    if (liveness?.isLive === false) {
      return 'KYC is not done because liveness failed — the selfie was not confirmed as a live person.';
    }
    const vendor = liveness?.vendorStatus?.trim();
    return vendor
      ? `KYC is not done because liveness did not pass (vendor status: ${vendor}).`
      : 'KYC is not done because Tenacio liveness did not pass.';
  }

  return row.kycStatusLabel?.trim()
    ? `KYC is not done (${row.kycStatusLabel}).`
    : 'KYC is not done yet.';
}
