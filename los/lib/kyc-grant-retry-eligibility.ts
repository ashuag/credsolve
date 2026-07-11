import type { LosApplicationDetails } from '@/lib/api';

const KYC_LIVENESS_MAX_ATTEMPTS = 3;

const BLOCKED_APPLICATION_STATUSES = new Set([
  'REJECTED',
  'DISBURSED',
  'KYC_FAILED',
  'CANCELLED',
]);

const BLOCKED_LEAD_STATUSES = new Set(['REJECTED', 'BLACKLISTED']);

/**
 * Mirrors backend `canGrantKycLivenessRetry` — used client-side so the LOS button
 * stays correct even when the API flag is stale.
 */
export function canGrantKycLivenessRetryFromRow(
  row: Pick<
    LosApplicationDetails,
    | 'kycStatus'
    | 'livenessPassed'
    | 'livenessCheckCompleted'
    | 'livenessAttempts'
    | 'livenessCheckedAt'
    | 'statusCode'
    | 'lead'
  >,
): boolean {
  if (row.kycStatus === 1) return false;
  if (row.kycStatus === 2) return false;
  if (row.livenessPassed) return false;

  if (BLOCKED_APPLICATION_STATUSES.has(row.statusCode)) return false;
  if (BLOCKED_LEAD_STATUSES.has(row.lead.statusCode)) return false;

  const escalated =
    row.lead.statusCode === 'INTERNAL_ERROR' || row.statusCode === 'INTERNAL_ERROR';
  const attemptsExhausted = row.livenessAttempts >= KYC_LIVENESS_MAX_ATTEMPTS;
  const hasFailedLiveness =
    !row.livenessPassed && (row.livenessAttempts > 0 || Boolean(row.livenessCheckedAt));

  if (!hasFailedLiveness) return false;

  const customerCanSelfRetry =
    !attemptsExhausted && !row.livenessCheckCompleted && !escalated;

  return !customerCanSelfRetry;
}
