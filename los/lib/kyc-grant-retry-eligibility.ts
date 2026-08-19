import type { LosApplicationDetails } from '@/lib/api';

const RE_KYC_BLOCKED_APPLICATION_STATUSES = new Set([
  'REJECTED',
  'PENNYDROP_FAILED',
  'DISBURSED',
  'CANCELLED',
  'ACTIVE',
]);

/**
 * Mirrors backend `canEnableReKyc` — re-enable KYC selfie (DigiLocker Aadhaar is kept when captured).
 */
export function canEnableReKycFromRow(
  row: Pick<
    LosApplicationDetails,
    | 'kycStatus'
    | 'livenessPassed'
    | 'livenessCheckCompleted'
    | 'livenessAttempts'
    | 'livenessCheckedAt'
    | 'statusCode'
    | 'lead'
    | 'kycPhotos'
  >,
): boolean {
  if (RE_KYC_BLOCKED_APPLICATION_STATUSES.has(row.statusCode)) return false;
  if (row.lead.statusCode === 'BLACKLISTED') return false;
  if (row.lead.statusCode === 'REJECTED' && row.statusCode !== 'KYC_FAILED') return false;

  const hasArtifacts = Boolean(
    row.kycPhotos?.selfiePath?.trim() || row.kycPhotos?.aadhaarPhotoPath?.trim(),
  );
  const hasProgress =
    row.kycStatus === 1 ||
    row.kycStatus === 2 ||
    row.kycStatus === 3 ||
    row.livenessPassed ||
    row.livenessCheckCompleted ||
    row.livenessAttempts > 0 ||
    Boolean(row.livenessCheckedAt) ||
    hasArtifacts;

  return hasProgress;
}
