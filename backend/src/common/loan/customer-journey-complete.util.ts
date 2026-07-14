import { APPLICATION_KYC_STATUS } from '../constants/application.constants';

const PAN_VERIFIED = 1;
const BUREAU_FETCHED_SUCCESS = 1;

/** Snapshot used to decide if the customer journey is complete and ready for LOS approval. */
export type CustomerJourneyCompleteInput = {
  fullName: string | null | undefined;
  panVerified: number | null | undefined;
  bureauFetched: number | null | undefined;
  hasBureauReport?: boolean;
  selectedLoanAmount: { toString(): string } | string | number | null | undefined;
  emailVerifiedAt: Date | string | null | undefined;
  loanDocumentsAcceptedAt: Date | string | null | undefined;
  kycStatus: number | null | undefined;
  kycCompletedAt: Date | string | null | undefined;
  bankAccountNumber: string | null | undefined;
  referencesCount: number;
};

export function isCustomerJourneyComplete(input: CustomerJourneyCompleteInput): boolean {
  const profileDone = Boolean(input.fullName?.trim());
  const panDone = (input.panVerified ?? 0) === PAN_VERIFIED;
  const bureauDone =
    (input.bureauFetched ?? 0) === BUREAU_FETCHED_SUCCESS || Boolean(input.hasBureauReport);
  const loanDone = Boolean(
    input.selectedLoanAmount != null && String(input.selectedLoanAmount).trim() !== '',
  );
  const emailDone = Boolean(input.emailVerifiedAt);
  const docsDone = Boolean(input.loanDocumentsAcceptedAt);
  const kycDone =
    (input.kycStatus ?? 0) === APPLICATION_KYC_STATUS.COMPLETED && Boolean(input.kycCompletedAt);
  const bankDone = Boolean(input.bankAccountNumber?.trim());
  const refsDone = (input.referencesCount ?? 0) >= 2;

  return (
    profileDone &&
    panDone &&
    bureauDone &&
    loanDone &&
    emailDone &&
    docsDone &&
    kycDone &&
    bankDone &&
    refsDone
  );
}
