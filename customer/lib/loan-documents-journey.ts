import type { CustomerSessionResponse } from './api/customer-session';

/** True after the sanction letter was reviewed on /loan-documents (eSign OTP is later). */
export function isLoanDocumentsJourneyComplete(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  return Boolean(
    session &&
      session.authenticated === true &&
      session.journey.loanDocumentsCompleted === true,
  );
}
