import type { LosLivenessSummary, LosSelfieFaceValidation } from '@/lib/api';

export function formatConfidencePercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatLaplacianVariance(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(1);
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
