import {
  APPLICATION_KYC_STATUS,
  APPLICATION_STATUS,
  type ApplicationStatus,
} from '../../common/constants/application.constants';
import { KYC_LIVENESS_MAX_ATTEMPTS } from '../../common/constants/kyc.constants';
import { LEAD_STATUS, type LeadStatus } from '../../common/constants/lead.constants';

export type KycGrantRetrySnapshot = {
  kycStatus: number;
  livenessPassed: boolean;
  livenessCheckCompleted: boolean;
  livenessAttempts: number;
  livenessCheckedAt?: Date | string | null;
  applicationStatusCode: string;
  leadStatusCode: string;
};

const BLOCKED_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.DISBURSED,
  APPLICATION_STATUS.KYC_FAILED,
  APPLICATION_STATUS.CANCELLED,
]);

const BLOCKED_LEAD_STATUSES = new Set<LeadStatus>([
  LEAD_STATUS.REJECTED,
  LEAD_STATUS.BLACKLISTED,
]);

/** True when LOS ops may grant the customer one more KYC liveness attempt. */
export function canGrantKycLivenessRetry(snapshot: KycGrantRetrySnapshot): boolean {
  if (snapshot.kycStatus === APPLICATION_KYC_STATUS.COMPLETED) return false;
  if (snapshot.kycStatus === APPLICATION_KYC_STATUS.FAILED) return false;
  if (snapshot.livenessPassed) return false;

  if (BLOCKED_APPLICATION_STATUSES.has(snapshot.applicationStatusCode as ApplicationStatus)) {
    return false;
  }
  if (BLOCKED_LEAD_STATUSES.has(snapshot.leadStatusCode as LeadStatus)) {
    return false;
  }

  const escalated =
    snapshot.leadStatusCode === LEAD_STATUS.INTERNAL_ERROR ||
    snapshot.applicationStatusCode === APPLICATION_STATUS.INTERNAL_ERROR;
  const attemptsExhausted = snapshot.livenessAttempts >= KYC_LIVENESS_MAX_ATTEMPTS;
  const hasFailedLiveness =
    !snapshot.livenessPassed &&
    (snapshot.livenessAttempts > 0 || Boolean(snapshot.livenessCheckedAt));

  if (!hasFailedLiveness) return false;

  // Customer can retry on their own while attempts remain and the pipeline is still open.
  const customerCanSelfRetry =
    !attemptsExhausted && !snapshot.livenessCheckCompleted && !escalated;

  return !customerCanSelfRetry;
}
