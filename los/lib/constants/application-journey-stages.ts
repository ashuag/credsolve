/**
 * Canonical customer-journey stages for an application.
 * Keep list order identical to the customer portal / application review journey.
 */
export const APPLICATION_JOURNEY_STAGES = [
  { id: 'profile', label: 'Profile' },
  { id: 'credit', label: 'PAN & bureau' },
  { id: 'loan', label: 'Loan offer' },
  { id: 'email', label: 'Email OTP' },
  { id: 'letter', label: 'Sanction letter' },
  { id: 'kyc', label: 'KYC & liveness' },
  { id: 'bank', label: 'Bank details' },
  { id: 'refs', label: 'References' },
] as const;

export type ApplicationJourneyStageId = (typeof APPLICATION_JOURNEY_STAGES)[number]['id'];
export type ApplicationJourneyStageLabel = (typeof APPLICATION_JOURNEY_STAGES)[number]['label'];

/** Select/filter options for LOS tables (value === label). */
export const APPLICATION_JOURNEY_STAGE_FILTER_OPTIONS = APPLICATION_JOURNEY_STAGES.map((stage) => ({
  value: stage.label,
  label: stage.label,
}));

export function applicationJourneyStageLabel(id: ApplicationJourneyStageId): ApplicationJourneyStageLabel {
  const stage = APPLICATION_JOURNEY_STAGES.find((s) => s.id === id);
  if (!stage) {
    throw new Error(`Unknown application journey stage id: ${id}`);
  }
  return stage.label;
}
