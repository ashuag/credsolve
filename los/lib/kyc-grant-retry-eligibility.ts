import type { LosApplicationDetails } from '@/lib/api';
import { isLosAadhaarKycComplete } from '@/lib/customer-journey';

const RE_KYC_BLOCKED_APPLICATION_STATUSES = new Set([
  'REJECTED',
  'PENNYDROP_FAILED',
  'UNDER_REVIEW',
  'DISBURSED',
  'CANCELLED',
  'ACTIVE',
]);

/** True once liveness has a result — not while the check is still pending. */
export function isLivenessFinishedForReKyc(
  row: Pick<
    LosApplicationDetails,
    'kycStatus' | 'livenessPassed' | 'livenessCheckCompleted' | 'livenessAttempts' | 'livenessCheckedAt'
  >,
): boolean {
  return (
    row.kycStatus === 1 ||
    row.livenessPassed === true ||
    row.livenessCheckCompleted === true ||
    Boolean(row.livenessCheckedAt) ||
    row.livenessAttempts >= 3
  );
}

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

  return isLivenessFinishedForReKyc(row);
}

/**
 * Mirrors backend `canEnableAadhaarReattempt` — reset OTP/DigiLocker so the customer starts Aadhaar OTP again.
 */
export function canEnableAadhaarReattemptFromRow(
  row: Pick<
    LosApplicationDetails,
    | 'canEnableAadhaarReattempt'
    | 'aadhaarKycCompleted'
    | 'aadhaarNameMatchPendingReview'
    | 'aadhaarIdentityFailure'
    | 'aadhaarDetail'
    | 'aadhaarDownloadLogs'
    | 'statusCode'
    | 'kycStatus'
    | 'lead'
    | 'kycPhotos'
  >,
): boolean {
  if (row.canEnableAadhaarReattempt) return true;
  if (isLosAadhaarKycComplete(row)) return false;
  if (row.lead.statusCode === 'BLACKLISTED') return false;

  const recoverableKycFailure =
    row.kycStatus === 2 ||
    Boolean(row.aadhaarIdentityFailure) ||
    row.statusCode === 'KYC_FAILED';

  if (
    RE_KYC_BLOCKED_APPLICATION_STATUSES.has(row.statusCode) &&
    !(recoverableKycFailure && row.statusCode === 'REJECTED')
  ) {
    return false;
  }
  if (
    row.lead.statusCode === 'REJECTED' &&
    row.statusCode !== 'KYC_FAILED' &&
    row.statusCode !== 'REJECTED'
  ) {
    return false;
  }

  return recoverableKycFailure || (row.aadhaarDownloadLogs?.length ?? 0) > 0;
}
