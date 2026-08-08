export type CustomerLookupOption = {
  value: string;
  label: string;
};

export const CUSTOMER_CREDIT_CONSENT_TEXT =
  "I accept the T&Cs of TU CIBIL and authorize MoneyCash to check my CIBIL Score & Report. I consent to MoneyCash app's lenders/lending partners retrieving my CKYC records, accessing my CIBIL profile, and conducting credit checks to assign my credit limit.";

/**
 * Shown with the consent checkbox. Accurate because the bureau call is a soft pull
 * (`runBureauSoftPull` / `experian-soft-pull`), which is not a score-affecting enquiry.
 */
export const CUSTOMER_CREDIT_CONSENT_REASSURANCE =
  'This is a soft enquiry — checking your eligibility will not affect your credit score.';

export function mapLookupToOption(entry: { key: string; name: string }): CustomerLookupOption {
  return { value: entry.key, label: entry.name.trim() };
}

const ANNUAL_METRIC_OCCUPATIONS = new Set(
  ['SELF_EMPLOYED_PROFESSIONAL', 'SELF_EMPLOYED_BUSINESS']
);

const MONTHLY_METRIC_OCCUPATIONS = new Set(
  ['SALARIED', 'STUDENT', 'HOMEMAKER', 'RETIRED']
);

export function usesAnnualFinancialMetric(occupation?: string) {
  return occupation != null && ANNUAL_METRIC_OCCUPATIONS.has(occupation);
}

export function usesMonthlyIncomeMetric(occupation?: string) {
  return occupation != null && MONTHLY_METRIC_OCCUPATIONS.has(occupation);
}

export function getFinancialMetricLabel(occupation?: string) {
  if (usesAnnualFinancialMetric(occupation)) return 'Annual turnover / annual profit';
  if (usesMonthlyIncomeMetric(occupation)) return 'Monthly income';
  return 'Income details';
}

export function getFinancialMetricHelp(occupation?: string) {
  if (usesAnnualFinancialMetric(occupation)) return 'Share your latest annual turnover and annual profit in INR.';
  if (usesMonthlyIncomeMetric(occupation)) return 'Share your current take-home monthly income in INR.';
  return 'Share your income details if applicable.';
}
