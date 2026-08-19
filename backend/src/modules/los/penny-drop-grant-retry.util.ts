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
]);

/** True when LOS ops may grant one more customer penny-drop (bank verification) attempt. */
export function canGrantPennyDropAttempt(snapshot: PennyDropGrantSnapshot): boolean {
  if (snapshot.bankVerified || snapshot.disbursed) return false;
  if (GRANT_BLOCKED_APPLICATION_STATUSES.has(snapshot.applicationStatusCode as ApplicationStatus)) {
    return false;
  }
  if (snapshot.leadStatusCode === LEAD_STATUS.BLACKLISTED) return false;

  const pennyFailed = snapshot.applicationStatusCode === APPLICATION_STATUS.PENNYDROP_FAILED;
  const attemptsExhausted = snapshot.attemptsUsed >= snapshot.attemptsAllowed;
  // Lead REJECTED is expected after penny-drop failure — grant recovers the lead.
  return pennyFailed || attemptsExhausted;
}
