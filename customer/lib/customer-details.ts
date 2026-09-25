export type CustomerLookupOption = {
  value: string;
  label: string;
};

export const CUSTOMER_CREDIT_CONSENT_TEXT =
  "I accept the T&Cs of TU CIBIL and authorize CredSolve to check my CIBIL Score & Report. I consent to CredSolve app's lenders/lending partners retrieving my CKYC records, accessing my CIBIL profile, and conducting credit checks to assign my credit limit.";

/**
 * Shown with the consent checkbox. Accurate because the bureau call is a soft pull
 * (`runBureauSoftPull` / `experian-soft-pull`), which is not a score-affecting enquiry.
 */
export const CUSTOMER_CREDIT_CONSENT_REASSURANCE =
  'This is a soft enquiry — checking your eligibility will not affect your credit score.';

export function mapLookupToOption(entry: { key: string; name: string }): CustomerLookupOption {
  return { value: entry.key, label: entry.name.trim() };
}

export function usesAnnualFinancialMetric(_occupation?: string) {
  return false;
}

export function usesMonthlyIncomeMetric(occupation?: string) {
  return occupation != null && occupation.trim() !== '';
}

export function getFinancialMetricLabel(_occupation?: string) {
  return 'Monthly income';
}

export function getFinancialMetricHelp(_occupation?: string) {
  return 'Share your current take-home monthly income in INR.';
}
