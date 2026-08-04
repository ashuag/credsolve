import type { CustomerSessionResponse } from './api/customer-session';

/** True after loan documents were reviewed/agreed (no OTP required on that page). */
export function isLoanDocumentsJourneyComplete(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  return Boolean(
    session &&
      session.authenticated === true &&
      session.journey.loanDocumentsCompleted === true,
  );
}
