import { APPLICATION_STATUS, type ApplicationStatus } from '../../common/constants/application.constants';
import { LEAD_STATUS } from '../../common/constants/lead.constants';

export type PennyDropGrantSnapshot = {
  attemptsUsed: number;
  attemptsAllowed: number;
  bankVerified: boolean;
  disbursed: boolean;
  applicationStatusCode: string;
  leadStatusCode: string;
};

const GRANT_BLOCKED_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.DISBURSED,
  APPLICATION_STATUS.CANCELLED,
  APPLICATION_STATUS.ACTIVE,
  APPLICATION_STATUS.UNDER_REVIEW,
]);

export type PennyDropRecheckSnapshot = {
  hasAccountToRecheck: boolean;
  bankVerified: boolean;
  nameMatchPendingReview: boolean;
  /** Latest `application_bank_account_detail.status`, or null when there is no attempt. */
  latestAttemptMatched: boolean | null;
  disbursed: boolean;
  applicationStatusCode: string;
  leadStatusCode: string;
};

const RECHECK_BLOCKED_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.DISBURSED,
  APPLICATION_STATUS.CANCELLED,
  APPLICATION_STATUS.ACTIVE,
]);

/**
 * True when LOS ops may re-run penny drop on the last submitted account.
 * Hidden once the account already auto-passed (or credit approved it) and the loan is not in name review.
 */
export function canRecheckPennyDrop(snapshot: PennyDropRecheckSnapshot): boolean {
  if (!snapshot.hasAccountToRecheck || snapshot.disbursed) return false;
  if (RECHECK_BLOCKED_APPLICATION_STATUSES.has(snapshot.applicationStatusCode as ApplicationStatus)) {
    return false;
  }
  if (snapshot.leadStatusCode === LEAD_STATUS.BLACKLISTED) return false;
  if (snapshot.nameMatchPendingReview) return true;
  if (snapshot.latestAttemptMatched === false) return true;
  return !snapshot.bankVerified;
}

/** True when LOS ops may grant one more customer penny-drop (bank verification) attempt. */
export function canGrantPennyDropAttempt(snapshot: PennyDropGrantSnapshot): boolean {
  if (snapshot.bankVerified || snapshot.disbursed) return false;
  if (GRANT_BLOCKED_APPLICATION_STATUSES.has(snapshot.applicationStatusCode as ApplicationStatus)) {
    return false;
  }
  if (snapshot.leadStatusCode === LEAD_STATUS.BLACKLISTED) return false;

  const pennyFailed = snapshot.applicationStatusCode === APPLICATION_STATUS.PENNYDROP_FAILED;
  const attemptsExhausted = snapshot.attemptsUsed >= snapshot.attemptsAllowed;
  // Lead may still be active (customer finishes references / eSign) or historically REJECTED.
  return pennyFailed || attemptsExhausted;
}
