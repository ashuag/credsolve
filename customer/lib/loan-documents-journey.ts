import type { CustomerSessionResponse } from './api/customer-session';

/** True only after sanction letter + loan agreement OTP acceptance. */
export function isLoanDocumentsJourneyComplete(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  return Boolean(
    session &&
      session.authenticated === true &&
      session.journey.loanDocumentsCompleted === true,
  );
}
