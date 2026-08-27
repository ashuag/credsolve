import type { LosApplicationDetails, LosLeadDetails } from '@/lib/api';
import {
  APPLICATION_JOURNEY_STAGES,
  APPLICATION_JOURNEY_STAGE_FILTER_OPTIONS,
  applicationJourneyStageLabel,
} from '@/lib/constants/application-journey-stages';
import { formatPersonName } from '@/lib/format-person-name';
import { BANK_DETAIL_FAILED_LABEL, PENNY_DROP_FAILED_LABEL, isBankDetailFailed } from '@/lib/penny-drop-grant-retry-eligibility';

export type JourneyStepState = 'done' | 'active' | 'pending' | 'failed';

export type JourneyStep = {
  id: string;
  label: string;
  state: JourneyStepState;
  detail?: string;
};

const PAN_VERIFIED = { NOT_CHECKED: 0, VERIFIED: 1, NOT_VERIFIED: 2 } as const;
const BUREAU_FETCHED = { NOT_FETCHED: 0, SUCCESS: 1, FAILED: 2 } as const;
const KYC_COMPLETED = 1;
const KYC_FAILED_STATUS = 2;

function step(
  id: string,
  label: string,
  done: boolean,
  failed: boolean,
  detail?: string,
): JourneyStep {
  if (failed) return { id, label, state: 'failed', detail };
  if (done) return { id, label, state: 'done', detail };
  return { id, label, state: 'pending', detail };
}

function firstPendingIndex(steps: JourneyStep[]): number {
  const idx = steps.findIndex((s) => s.state === 'pending');
  return idx === -1 ? steps.length - 1 : idx;
}

function markActiveStep(steps: JourneyStep[]): JourneyStep[] {
  if (steps.some((s) => s.state === 'failed')) return steps;
  const activeIdx = firstPendingIndex(steps);
  return steps.map((s, i) =>
    s.state === 'pending' && i === activeIdx ? { ...s, state: 'active' as const } : s,
  );
}

/** Lead intake funnel before / during application handoff. */
export function buildLeadIntakeJourney(lead: LosLeadDetails): JourneyStep[] {
  const rejected = lead.statusCode.toUpperCase() === 'REJECTED';
  const profileDone = Boolean(lead.profile?.fullName?.trim() && lead.profile?.dateOfBirth);
  const panCode = lead.panVerified ?? PAN_VERIFIED.NOT_CHECKED;
  const panDone = panCode === PAN_VERIFIED.VERIFIED;
  const panFailed = Boolean(
    rejected &&
      (panCode === PAN_VERIFIED.NOT_VERIFIED ||
        lead.rejectionReason?.code.includes('PAN') ||
        lead.leadStatusNote?.toLowerCase().includes('pan')),
  );
  const bureauCode = lead.bureauFetched ?? BUREAU_FETCHED.NOT_FETCHED;
  const bureauDone = bureauCode === BUREAU_FETCHED.SUCCESS;
  const bureauFailed = Boolean(
    rejected &&
      (bureauCode === BUREAU_FETCHED.FAILED ||
        lead.bureauFetchedNote ||
        lead.rejectionReason?.code.includes('BUREAU') ||
        lead.rejectionReason?.code.includes('CIBIL') ||
        lead.rejectionReason?.code.includes('BRE')),
  );
  const converted = lead.statusCode.toUpperCase() === 'CONVERTED' || lead.applications.length > 0;

  const steps: JourneyStep[] = [
    step('sign-in', 'Mobile OTP', true, false, lead.mobileNumber),
    step(
      'profile',
      'Profile',
      profileDone,
      false,
      profileDone && lead.profile?.fullName?.trim()
        ? formatPersonName(lead.profile.fullName)
        : profileDone
          ? undefined
          : 'Pending',
    ),
    step('pan', 'PAN verify', panDone, panFailed, lead.panVerifiedLabel),
    step('bureau', 'Bureau / BRE', bureauDone, bureauFailed, lead.bureauFetchedLabel),
    step(
      'outcome',
      converted ? 'Application started' : rejected ? 'Rejected' : 'In progress',
      converted,
      rejected && !converted,
      lead.statusLabel,
    ),
  ];

  return markActiveStep(steps);
}

export function isLosAadhaarKycComplete(row: {
  aadhaarKycCompleted?: boolean;
  aadhaarDetail?: {
    fullName: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    address: string | null;
    maskedAadhaar: string | null;
  } | null;
  kycPhotos?: { aadhaarPhotoPath: string | null };
}): boolean {
  if (row.aadhaarKycCompleted) return true;
  const aadhaar = row.aadhaarDetail;
  if (
    aadhaar &&
    (aadhaar.fullName?.trim() ||
      aadhaar.dateOfBirth ||
      aadhaar.gender?.trim() ||
      aadhaar.maskedAadhaar?.trim() ||
      aadhaar.address?.trim())
  ) {
    return true;
  }
  return Boolean(row.kycPhotos?.aadhaarPhotoPath?.trim());
}

function isSelfieCaptured(row: { selfieCaptured?: boolean; kycPhotos?: { selfiePath: string | null } }): boolean {
  if (row.selfieCaptured) return true;
  return Boolean(row.kycPhotos?.selfiePath?.trim());
}

function isDigilockerKycDone(
  row: Pick<LosApplicationDetails, 'kycStatus'>,
  aadhaarDone: boolean,
  selfieDone: boolean,
  kycFailed: boolean,
): boolean {
  if (!aadhaarDone) return false;
  return selfieDone || kycFailed || row.kycStatus === KYC_COMPLETED;
}

function isLivenessKycDone(row: LosApplicationDetails): boolean {
  return row.livenessPassed === true || (row.kycStatus === KYC_COMPLETED && row.kycCompletedAt != null);
}

function digilockerKycDetail(aadhaarDone: boolean, selfieDone: boolean): string | undefined {
  if (aadhaarDone && selfieDone) return 'Aadhaar + selfie';
  if (aadhaarDone) return 'Aadhaar complete';
  if (selfieDone) return 'Selfie';
  return undefined;
}

function livenessKycDetail(row: LosApplicationDetails, livenessDone: boolean): string | undefined {
  if (livenessDone) return 'Passed';
  if (row.livenessAttempts > 0 || row.livenessCheckedAt || row.livenessSummary?.checkedAt) {
    return row.livenessPassed ? 'Passed' : 'Failed';
  }
  return undefined;
}

/** Full customer journey on an application workspace (matches customer portal order). */
export function buildApplicationJourney(row: LosApplicationDetails): JourneyStep[] {
  const profile = row.lead.profile;
  const leadRejected = row.lead.statusCode.toUpperCase() === 'REJECTED';
  const appRejected = row.statusCode.toUpperCase().includes('REJECT');
  const rejected = appRejected || leadRejected;
  const kycFailed = row.statusCode.toUpperCase() === 'KYC_FAILED' || row.kycStatus === KYC_FAILED_STATUS;
  const pennyFailed = row.statusCode.toUpperCase() === 'PENNYDROP_FAILED';
  const nameReviewPending = Boolean(row.nameMatchPendingReview) || row.statusCode.toUpperCase() === 'UNDER_REVIEW';
  const bankFailed = isBankDetailFailed(row) || pennyFailed;

  const profileDone = Boolean(profile?.fullName?.trim());
  const panDone = (row.lead.panVerified ?? 0) === PAN_VERIFIED.VERIFIED;
  const bureauDone = (row.lead.bureauFetched ?? 0) === BUREAU_FETCHED.SUCCESS || Boolean(row.bureauReport);
  const loanDone = Boolean(row.details?.loanAmount);
  const refsDone = (row.referencesCount ?? 0) >= 2;
  const emailDone = Boolean(row.emailVerifiedAt);
  /** Reviewed sanction letter on /loan-documents (no OTP). */
  const letterReviewed = Boolean(row.loanDocuments.reviewedAt ?? row.loanDocuments.acceptedAt);
  /** Mobile OTP after references. */
  const letterAccepted = Boolean(row.loanDocuments.acceptedAt);
  const aadhaarDone = isLosAadhaarKycComplete(row);
  const selfieDone = isSelfieCaptured(row);
  const digilockerDone = isDigilockerKycDone(row, aadhaarDone, selfieDone, kycFailed);
  const livenessDone = isLivenessKycDone(row);
  const bankDone = Boolean(row.disbursement?.accountNumber || row.disbursement?.disbursedAt) && !nameReviewPending;

  const rejectionDetail =
    row.lead.rejectionReason?.label ??
    row.lead.leadStatusNote?.trim() ??
    (leadRejected ? row.lead.statusLabel : appRejected ? row.statusLabel : undefined);

  const doneById = {
    profile: profileDone,
    credit: panDone && bureauDone,
    loan: loanDone,
    email: emailDone,
    letter: letterReviewed,
    digilockerKyc: digilockerDone,
    livenessKyc: livenessDone,
    bank: bankDone,
    refs: refsDone,
    esign: letterAccepted,
  } as const;
  const failedById = {
    profile: false,
    credit: rejected && !bureauDone,
    loan: false,
    email: false,
    letter: false,
    digilockerKyc: kycFailed && !aadhaarDone,
    livenessKyc: kycFailed && aadhaarDone && (selfieDone || row.livenessAttempts > 0),
    bank: bankFailed,
    refs: false,
    esign: false,
  } as const;
  const detailById: Partial<Record<(typeof APPLICATION_JOURNEY_STAGES)[number]['id'], string | undefined>> = {
    credit: row.bureauReport?.cibilScore != null ? `CIBIL ${row.bureauReport.cibilScore}` : undefined,
    loan: row.details?.loanAmount ? `₹${row.details.loanAmount}` : undefined,
    letter: letterAccepted ? 'Accepted' : letterReviewed ? 'Reviewed' : undefined,
    digilockerKyc: digilockerKycDetail(aadhaarDone, selfieDone),
    livenessKyc: livenessKycDetail(row, livenessDone),
    bank: nameReviewPending
      ? 'Name match review'
      : bankFailed
        ? BANK_DETAIL_FAILED_LABEL
        : undefined,
    refs: refsDone ? `${row.referencesCount} saved` : undefined,
    esign: letterAccepted ? 'Verified' : undefined,
  };

  const steps: JourneyStep[] = APPLICATION_JOURNEY_STAGES.map((stage) =>
    step(stage.id, stage.label, doneById[stage.id], failedById[stage.id], detailById[stage.id]),
  );

  if (rejected || kycFailed || pennyFailed) {
    const label = kycFailed && !rejected
      ? 'KYC failed'
      : pennyFailed && !rejected
        ? BANK_DETAIL_FAILED_LABEL
        : leadRejected
          ? 'Lead rejected'
          : 'Application rejected';
    steps.push(step('outcome', label, false, true, rejectionDetail));
    return steps;
  }

  return markActiveStep(steps);
}

export function journeyProgressPercent(steps: JourneyStep[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.state === 'done').length;
  const active = steps.some((s) => s.state === 'active') ? 0.5 : 0;
  return Math.round(((done + active) / steps.length) * 100);
}

export function isApplicationJourneyStepActive(row: LosApplicationDetails, stepId: string): boolean {
  return buildApplicationJourney(row).some((s) => s.id === stepId && s.state === 'active');
}

/** Minimal list-row shape for resolving the active customer journey stage label. */
export type ApplicationListStageInput = {
  statusCode: string;
  statusLabel: string;
  kycStatus: number;
  kycStatusLabel: string;
  kycCompletedAt: string | null;
  emailVerifiedAt: string | null;
  loanDocumentsReviewedAt: string | null;
  loanDocumentsAcceptedAt: string | null;
  livenessPassed: boolean;
  livenessAttempts?: number;
  aadhaarKycCompleted?: boolean;
  selfieCaptured?: boolean;
  selectedLoanAmount: string | null;
  referencesCount: number;
  bankAccountNumber: string | null;
  disbursedAt: string | null;
  fullName: string | null;
  leadStatusCode: string;
  leadStatusLabel: string;
  leadStatusNote?: string | null;
  panVerified: number;
  bureauFetched: number;
  nameMatchPendingReview?: boolean;
};

/** Active journey stage for application list rows (matches application review hero). */
export function resolveApplicationStageLabel(input: ApplicationListStageInput): string {
  const leadRejected = input.leadStatusCode.toUpperCase() === 'REJECTED';
  const appRejected = input.statusCode.toUpperCase().includes('REJECT');
  const rejected = appRejected || leadRejected;
  const kycFailed = input.statusCode.toUpperCase() === 'KYC_FAILED' || input.kycStatus === 2;
  const pennyFailed = input.statusCode.toUpperCase() === 'PENNYDROP_FAILED';

  if (rejected || kycFailed || pennyFailed) {
    if (input.leadStatusCode.toUpperCase().includes('REJECT')) return input.leadStatusLabel;
    if (input.statusCode.toUpperCase().includes('REJECT')) return input.statusLabel;
    if (input.statusCode.toUpperCase() === 'KYC_FAILED') return input.kycStatusLabel;
    if (pennyFailed) return input.statusLabel || BANK_DETAIL_FAILED_LABEL;
    return 'Rejected';
  }

  if (
    (input.leadStatusNote?.trim().toLowerCase() === BANK_DETAIL_FAILED_LABEL.toLowerCase() ||
      input.leadStatusNote?.trim().toLowerCase() === PENNY_DROP_FAILED_LABEL.toLowerCase()) &&
    !input.bankAccountNumber
  ) {
    return BANK_DETAIL_FAILED_LABEL;
  }

  const profileDone = Boolean(input.fullName?.trim());
  const panDone = input.panVerified === PAN_VERIFIED.VERIFIED;
  const bureauDone = input.bureauFetched === BUREAU_FETCHED.SUCCESS;
  const loanDone = Boolean(input.selectedLoanAmount);
  const emailDone = Boolean(input.emailVerifiedAt);
  const letterReviewed = Boolean(input.loanDocumentsReviewedAt ?? input.loanDocumentsAcceptedAt);
  const letterAccepted = Boolean(input.loanDocumentsAcceptedAt);
  const aadhaarDone = Boolean(input.aadhaarKycCompleted);
  const selfieDone = Boolean(input.selfieCaptured);
  const digilockerDone =
    aadhaarDone && (selfieDone || kycFailed || input.kycStatus === KYC_COMPLETED);
  const livenessDone =
    input.livenessPassed === true || (input.kycStatus === KYC_COMPLETED && input.kycCompletedAt != null);
  const bankDone = Boolean(input.bankAccountNumber || input.disbursedAt) && !input.nameMatchPendingReview;
  const refsDone = input.referencesCount >= 2;

  const doneById = {
    profile: profileDone,
    credit: panDone && bureauDone,
    loan: loanDone,
    email: emailDone,
    letter: letterReviewed,
    digilockerKyc: digilockerDone,
    livenessKyc: livenessDone,
    bank: bankDone,
    refs: refsDone,
    esign: letterAccepted,
  } as const;

  const active = APPLICATION_JOURNEY_STAGES.find((stage) => !doneById[stage.id]);
  return active?.label ?? input.statusLabel;
}

export { APPLICATION_JOURNEY_STAGES, APPLICATION_JOURNEY_STAGE_FILTER_OPTIONS, applicationJourneyStageLabel };
