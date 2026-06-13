import type { LosApplicationDetails, LosLeadDetails } from '@/lib/api';
import { formatPersonName } from '@/lib/format-person-name';

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

/** Full customer journey on an application workspace. */
export function buildApplicationJourney(row: LosApplicationDetails): JourneyStep[] {
  const profile = row.lead.profile;
  const rejected =
    row.statusCode.toUpperCase().includes('REJECT') || row.lead.statusCode.toUpperCase() === 'REJECTED';
  const kycFailed = row.statusCode.toUpperCase() === 'KYC_FAILED' || row.kycStatus === 2;

  const profileDone = Boolean(profile?.fullName?.trim());
  const panDone = (row.lead.panVerified ?? 0) === PAN_VERIFIED.VERIFIED;
  const bureauDone = (row.lead.bureauFetched ?? 0) === BUREAU_FETCHED.SUCCESS || Boolean(row.bureauReport);
  const loanDone = Boolean(row.details?.loanAmount);
  const refsDone = (row.referencesCount ?? 0) >= 2;
  const emailDone = Boolean(row.emailVerifiedAt);
  const docsDone = Boolean(row.loanDocuments.acceptedAt);
  const kycDone = row.kycStatus === KYC_COMPLETED && row.kycCompletedAt != null;
  const bankDone = Boolean(row.disbursement?.accountNumber || row.disbursement?.disbursedAt);

  const steps: JourneyStep[] = [
    step('profile', 'Profile', profileDone, false),
    step('credit', 'PAN & bureau', panDone && bureauDone, rejected && !bureauDone, row.bureauReport?.cibilScore != null ? `CIBIL ${row.bureauReport.cibilScore}` : undefined),
    step('loan', 'Loan offer', loanDone, false, row.details?.loanAmount ? `₹${row.details.loanAmount}` : undefined),
    step('refs', 'References', refsDone, false, refsDone ? `${row.referencesCount} saved` : undefined),
    step('email', 'Email OTP', emailDone, false),
    step('letter', 'Sanction letter', docsDone, false, row.loanDocuments.acceptedAt ? 'Accepted' : undefined),
    step('kyc', 'KYC & liveness', kycDone, kycFailed, row.kycStatusLabel),
    step('bank', 'Bank details', bankDone, false),
  ];

  return markActiveStep(steps);
}

export function journeyProgressPercent(steps: JourneyStep[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.state === 'done').length;
  const active = steps.some((s) => s.state === 'active') ? 0.5 : 0;
  return Math.round(((done + active) / steps.length) * 100);
}
