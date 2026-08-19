import { loanAccountNumberForApplication } from './application-number.util';

/**
 * Builds the `loan_account_number` for a new loan at disbursement time.
 *
 * The public journey ID (`lead.lead_id` / `application.application_number`) is the
 * canonical ID; it is reused as the loan account number so lead → application → loan
 * stay linked by one alphanumeric identifier.
 */
export function resolveLoanAccountNumberAtDisbursement(applicationNumber: string): string {
  return loanAccountNumberForApplication(applicationNumber);
}
