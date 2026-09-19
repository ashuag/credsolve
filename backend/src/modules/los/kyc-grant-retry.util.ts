import {
  APPLICATION_KYC_STATUS,
  APPLICATION_STATUS,
  type ApplicationStatus,
} from '../../common/constants/application.constants';
import { LEAD_STATUS, type LeadStatus } from '../../common/constants/lead.constants';

/** Snapshot for re-enabling KYC selfie (DigiLocker Aadhaar is kept when already captured). */
export type KycEnableReKycSnapshot = {
  kycStatus: number;
  livenessPassed: boolean;
  livenessCheckCompleted: boolean;
  livenessAttempts: number;
  livenessCheckedAt?: Date | string | null;
  applicationStatusCode: string;
  leadStatusCode: string;
  /** True when DigiLocker Aadhaar or a historical selfie artifact exists. */
  hasKycArtifacts?: boolean;
};

/** Terminal book states where KYC must not be reopened. */
const RE_KYC_BLOCKED_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.PENNYDROP_FAILED,
  APPLICATION_STATUS.UNDER_REVIEW,
  APPLICATION_STATUS.DISBURSED,
  APPLICATION_STATUS.CANCELLED,
  APPLICATION_STATUS.ACTIVE,
]);

/**
 * True when LOS ops may re-enable KYC selfie so the customer can retake the face step.
 * DigiLocker Aadhaar is not cleared when it is already complete.
 */
export function canEnableReKyc(snapshot: KycEnableReKycSnapshot): boolean {
  if (RE_KYC_BLOCKED_APPLICATION_STATUSES.has(snapshot.applicationStatusCode as ApplicationStatus)) {
    return false;
  }
  if (snapshot.leadStatusCode === LEAD_STATUS.BLACKLISTED) {
    return false;
  }
  if (
    snapshot.leadStatusCode === LEAD_STATUS.REJECTED &&
    snapshot.applicationStatusCode !== APPLICATION_STATUS.KYC_FAILED
  ) {
    return false;
  }

  return (
    snapshot.kycStatus === APPLICATION_KYC_STATUS.COMPLETED ||
    snapshot.livenessPassed ||
    snapshot.livenessCheckCompleted ||
    Boolean(snapshot.livenessCheckedAt) ||
    snapshot.livenessAttempts >= 3
  );
}

export type AadhaarReattemptSnapshot = {
  aadhaarCaptured: boolean;
  otpAttempts: number;
  digilockerAttempts: number;
  digilockerFallbackEligible: boolean;
  applicationStatusCode: string;
  leadStatusCode: string;
  kycFailed: boolean;
};

/** True when LOS ops may reset Aadhaar OTP/DigiLocker attempts so the customer starts OTP again. */
export function canEnableAadhaarReattempt(snapshot: AadhaarReattemptSnapshot): boolean {
  if (snapshot.leadStatusCode === LEAD_STATUS.BLACKLISTED) return false;

  const recoverableKycFailure =
    snapshot.kycFailed &&
    (snapshot.applicationStatusCode === APPLICATION_STATUS.KYC_FAILED ||
      snapshot.applicationStatusCode === APPLICATION_STATUS.REJECTED);

  // Identity-mismatch rejects still have Aadhaar on file — ops must be able to clear it and retry.
  if (snapshot.aadhaarCaptured && !recoverableKycFailure) return false;

  if (
    RE_KYC_BLOCKED_APPLICATION_STATUSES.has(snapshot.applicationStatusCode as ApplicationStatus) &&
    !recoverableKycFailure
  ) {
    return false;
  }
  if (
    snapshot.leadStatusCode === LEAD_STATUS.REJECTED &&
    snapshot.applicationStatusCode !== APPLICATION_STATUS.KYC_FAILED &&
    snapshot.applicationStatusCode !== APPLICATION_STATUS.REJECTED
  ) {
    return false;
  }

  return (
    recoverableKycFailure ||
    snapshot.otpAttempts > 0 ||
    snapshot.digilockerAttempts > 0 ||
    snapshot.digilockerFallbackEligible ||
    snapshot.kycFailed
  );
}
