import type { LosApplicationDetails } from '@/lib/api';

const GRANT_BLOCKED_APPLICATION_STATUSES = new Set([
  'REJECTED',
  'DISBURSED',
  'CANCELLED',
  'ACTIVE',
  'UNDER_REVIEW',
]);

/** LOS copy when penny-drop attempts are exhausted and bank details were never saved. */
export const BANK_DETAIL_FAILED_LABEL = 'Bank detail failed';
export const PENNY_DROP_FAILED_LABEL = 'Penny drop failed';

export function isPennyDropFailedNote(note: string | null | undefined): boolean {
  const value = note?.trim().toLowerCase();
  return value === BANK_DETAIL_FAILED_LABEL.toLowerCase() || value === PENNY_DROP_FAILED_LABEL.toLowerCase();
}

export function isBankDetailFailed(
  row: Pick<LosApplicationDetails, 'statusCode' | 'lead' | 'disbursement' | 'pennyDropVerification'>,
): boolean {
  if (row.statusCode.toUpperCase() === 'PENNYDROP_FAILED') return true;
  const bankVerified = Boolean(row.disbursement?.accountNumber?.trim());
  if (bankVerified) return false;
  const attempts = row.pennyDropVerification;
  if (attempts?.retryLimitReached && !attempts.bankVerified) return true;
  return isPennyDropFailedNote(row.lead.leadStatusNote);
}

const RECHECK_BLOCKED_APPLICATION_STATUSES = new Set(['REJECTED', 'DISBURSED', 'CANCELLED', 'ACTIVE']);

/**
 * Mirrors backend `canRecheckPennyDrop` — re-run penny drop on the last submitted account.
 */
export function canRecheckPennyDropFromRow(
  row: Pick<
    LosApplicationDetails,
    'statusCode' | 'lead' | 'disbursement' | 'loanAccount' | 'nameMatchPendingReview' | 'bankAccountAttempts'
  >,
): boolean {
  const status = row.statusCode.toUpperCase();
  if (RECHECK_BLOCKED_APPLICATION_STATUSES.has(status)) return false;
  if (row.lead.statusCode.toUpperCase() === 'BLACKLISTED') return false;

  const latest = row.bankAccountAttempts?.[0];
  const accountNumber = latest?.bankAccountNumber?.trim() || row.disbursement?.accountNumber?.trim() || '';
  const ifsc = latest?.ifscCode?.trim() || row.disbursement?.ifscCode?.trim() || '';
  if (!accountNumber || !ifsc) return false;

  const disbursed = Boolean(row.loanAccount?.disbursedAt || row.disbursement?.disbursedAt);
  if (disbursed) return false;

  const nameReview =
    Boolean(row.nameMatchPendingReview) || status === 'UNDER_REVIEW';
  if (nameReview) return true;
  if (latest && latest.status === false) return true;
  return !row.disbursement?.accountNumber?.trim();
}

/**
 * Mirrors backend `canGrantPennyDropAttempt` — grant one more bank verification try.
 * Lead REJECTED is allowed when penny-drop failed / attempts are exhausted (grant recovers the lead).
 */
export function canGrantPennyDropAttemptFromRow(
  row: Pick<LosApplicationDetails, 'statusCode' | 'lead' | 'disbursement' | 'loanAccount' | 'pennyDropVerification'>,
): boolean {
  const status = row.statusCode.toUpperCase();
  if (GRANT_BLOCKED_APPLICATION_STATUSES.has(status)) return false;
  if (row.lead.statusCode.toUpperCase() === 'BLACKLISTED') return false;

  const bankVerified = Boolean(row.disbursement?.accountNumber?.trim());
  const disbursed = Boolean(row.loanAccount?.disbursedAt || row.disbursement?.disbursedAt);
  if (bankVerified || disbursed) return false;

  if (status === 'PENNYDROP_FAILED' || isBankDetailFailed(row)) return true;

  const attempts = row.pennyDropVerification;
  if (!attempts) return false;
  return attempts.attemptsUsed >= attempts.attemptsAllowed;
}
